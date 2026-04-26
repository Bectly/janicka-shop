import { test, expect } from "@playwright/test";

// Live production JSON-LD / Rich Results validation (#614 — pre-Apr30
// GMC/Doppl + Pinterest catalog launch insurance). Read-only smoke against
// jvsatnik.cz; complements e2e/prod-smoke.spec.ts (#585) by adding deep
// JSON-LD parsing on the 5 highest-leverage URLs and feed cross-checks.
//
// GATE: opt-in via PROD_RICH_RESULTS=1 to keep `playwright test` from
// touching prod by default.
//
//   PROD_RICH_RESULTS=1 npx playwright test e2e/prod-rich-results.spec.ts
//
// SAFETY: every assertion is a GET — no auth, no mutations.

const PROD_BASE = process.env.PROD_RICH_RESULTS_URL ?? "https://jvsatnik.cz";

test.skip(
  process.env.PROD_RICH_RESULTS !== "1",
  "Prod rich-results audit is opt-in (PROD_RICH_RESULTS=1) — see header.",
);

test.use({ baseURL: PROD_BASE });

interface JsonLdNode {
  "@type"?: string | string[];
  [key: string]: unknown;
}

async function parseJsonLd(
  page: import("@playwright/test").Page,
): Promise<JsonLdNode[]> {
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const nodes: JsonLdNode[] = [];
  for (const raw of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `JSON-LD parse error: ${(err as Error).message} — block: ${raw.slice(0, 200)}`,
      );
    }
    if (Array.isArray(parsed)) {
      nodes.push(...(parsed as JsonLdNode[]));
    } else if (parsed && typeof parsed === "object") {
      nodes.push(parsed as JsonLdNode);
    }
  }
  return nodes;
}

function findType(nodes: JsonLdNode[], type: string): JsonLdNode | undefined {
  return nodes.find((n) => {
    const t = n["@type"];
    return Array.isArray(t) ? t.includes(type) : t === type;
  });
}

/**
 * Walk a JSON-LD object and surface any string field containing a literal
 * control character (\n, \r, \t). Apr 2026 incident: NEXT_PUBLIC_SITE_URL on
 * Vercel held a trailing \n; every Offer URL and feed link broke. Google
 * Rich Results rejects URLs with control chars.
 */
function findControlCharStrings(
  obj: unknown,
  path = "",
): Array<{ path: string; value: string }> {
  const found: Array<{ path: string; value: string }> = [];
  if (typeof obj === "string") {
    if (/[\n\r\t]/.test(obj)) found.push({ path, value: obj });
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => found.push(...findControlCharStrings(v, `${path}[${i}]`)));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      found.push(...findControlCharStrings(v, path ? `${path}.${k}` : k));
    }
  }
  return found;
}

test.describe("Prod JSON-LD / Rich Results — jvsatnik.cz", () => {
  test("/ homepage: WebSite + Organization + (ItemList | hot picks)", async ({
    page,
  }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);

    const nodes = await parseJsonLd(page);
    expect(nodes.length, "homepage missing JSON-LD blocks").toBeGreaterThan(0);

    expect(findType(nodes, "WebSite"), "missing WebSite schema").toBeTruthy();
    expect(findType(nodes, "Organization"), "missing Organization schema").toBeTruthy();

    // Hot picks / ItemList is a soft expectation — log if missing but don't
    // fail the whole gate (homepage hot-picks ItemList may be deferred).
    const itemList = findType(nodes, "ItemList");
    if (!itemList) {
      console.warn("homepage: no ItemList block (hot picks not exposed as schema)");
    }

    const ctrlIssues = findControlCharStrings(nodes);
    expect(
      ctrlIssues,
      `homepage JSON-LD has control chars in ${ctrlIssues.length} field(s): ${JSON.stringify(ctrlIssues.slice(0, 3))}`,
    ).toEqual([]);
  });

  test("/products: ItemList with itemListElement[]", async ({ page }) => {
    const res = await page.goto("/products", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);

    const nodes = await parseJsonLd(page);
    const itemList = findType(nodes, "ItemList");
    expect(itemList, "/products missing ItemList schema").toBeTruthy();
    expect(
      Array.isArray(itemList!.itemListElement) &&
        (itemList!.itemListElement as unknown[]).length > 0,
      "/products ItemList.itemListElement empty",
    ).toBe(true);

    const ctrlIssues = findControlCharStrings(nodes);
    expect(
      ctrlIssues,
      `/products JSON-LD has control chars: ${JSON.stringify(ctrlIssues.slice(0, 3))}`,
    ).toEqual([]);
  });

  test("active PDP: Product schema with InStock offer", async ({ page }) => {
    await page.goto("/products", { waitUntil: "domcontentloaded" });
    const firstHref = await page
      .locator('a[href^="/products/"]')
      .first()
      .getAttribute("href");
    expect(firstHref, "no product link found").toBeTruthy();

    const res = await page.goto(firstHref!, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);

    const nodes = await parseJsonLd(page);
    const product = findType(nodes, "Product");
    expect(product, "PDP missing Product schema").toBeTruthy();

    // Required Product fields per schema.org / Google Rich Results
    expect(product!.name, "Product.name missing").toBeTruthy();
    expect(product!.image, "Product.image missing").toBeTruthy();
    expect(product!.offers, "Product.offers missing").toBeTruthy();

    const offers = product!.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.priceCurrency, "Offer.priceCurrency missing").toBeTruthy();
    expect(offers.price, "Offer.price missing").toBeTruthy();
    expect(
      offers.availability,
      "Offer.availability must indicate InStock for active PDP",
    ).toBe("https://schema.org/InStock");

    // No undefined/null leaks in serialized JSON-LD
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    for (const raw of blocks) {
      expect(raw, "JSON-LD must not contain literal undefined").not.toMatch(/:\s*undefined\b/);
      expect(raw, "JSON-LD must not contain literal NaN").not.toMatch(/:\s*NaN\b/);
    }

    const ctrlIssues = findControlCharStrings(nodes);
    expect(
      ctrlIssues,
      `active PDP JSON-LD has control chars: ${JSON.stringify(ctrlIssues.slice(0, 3))}`,
    ).toEqual([]);
  });

  test("sold PDP: Product schema with OutOfStock offer", async ({
    page,
    request,
  }) => {
    // Pick first OutOfStock product from the GMC feed so we don't depend on a
    // specific slug that may be deleted between cycles.
    const feedRes = await request.get("/api/feed/google-merchant");
    expect(feedRes.status()).toBe(200);
    const xml = await feedRes.text();

    // Match each <item>...</item>, find one whose g:availability is out_of_stock.
    const items = xml.match(/<item\b[\s\S]*?<\/item>/g) ?? [];
    let soldHref: string | null = null;
    for (const item of items) {
      if (/<g:availability>\s*out[_ ]of[_ ]stock/i.test(item)) {
        const linkMatch = item.match(/<g:link>([^<]+)<\/g:link>/);
        if (linkMatch) {
          soldHref = linkMatch[1].trim();
          break;
        }
      }
    }
    test.skip(!soldHref, "no out_of_stock items in GMC feed — nothing sold yet");

    const url = new URL(soldHref!.replace(/\s+/g, ""));
    const res = await page.goto(url.pathname, { waitUntil: "domcontentloaded" });
    expect(res?.status(), `sold PDP ${url.pathname} status`).toBe(200);

    const nodes = await parseJsonLd(page);
    const product = findType(nodes, "Product");
    expect(product, "sold PDP missing Product schema").toBeTruthy();

    const offers = product!.offers as Record<string, unknown>;
    expect(
      offers.availability,
      "sold PDP Offer.availability should be OutOfStock or SoldOut",
    ).toMatch(/schema\.org\/(OutOfStock|SoldOut)/);
  });

  test("/about (or /o-nas redirect): Organization schema", async ({
    page,
  }) => {
    // /o-nas legacy slug 308-redirects to /about — follow the redirect.
    const res = await page.goto("/o-nas", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    expect(page.url(), "expected /about as canonical About URL").toContain("/about");

    const nodes = await parseJsonLd(page);
    expect(
      findType(nodes, "Organization") ?? findType(nodes, "AboutPage"),
      "About page missing Organization or AboutPage schema",
    ).toBeTruthy();

    const ctrlIssues = findControlCharStrings(nodes);
    expect(
      ctrlIssues,
      `About JSON-LD has control chars: ${JSON.stringify(ctrlIssues.slice(0, 3))}`,
    ).toEqual([]);
  });

  test("GMC feed: every <g:link> is a clean absolute URL", async ({ request }) => {
    // GMC rejects URLs with control chars (\n, \r). Apr 2026 prod incident:
    // NEXT_PUBLIC_SITE_URL had a trailing \n and broke every product link.
    const res = await request.get("/api/feed/google-merchant");
    expect(res.status()).toBe(200);
    const xml = await res.text();

    const links = Array.from(xml.matchAll(/<g:link>([^<]+)<\/g:link>/g)).map(
      (m) => m[1],
    );
    expect(links.length, "GMC feed exposed zero <g:link> entries").toBeGreaterThan(0);

    const broken = links.filter((l) => /[\n\r\t]/.test(l) || !/^https?:\/\//.test(l.trim()));
    expect(
      broken.length,
      `GMC feed has ${broken.length}/${links.length} broken links — sample: ${JSON.stringify(broken[0])}`,
    ).toBe(0);
  });

  test("Pinterest feed: link column rows are clean absolute URLs", async ({
    request,
  }) => {
    const res = await request.get("/api/feed/pinterest");
    expect(res.status()).toBe(200);
    const tsv = await res.text();
    const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    const header = lines[0].split("\t");
    const linkCol = header.indexOf("link");
    expect(linkCol, "Pinterest header missing link column").toBeGreaterThanOrEqual(0);

    // Pinterest TSV uses TSV row delimiter \n; embedded \n in URL would split
    // the row early. Detect this by checking each row has same column count
    // AND link col looks like absolute URL.
    const broken: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      if (cols.length !== header.length) {
        broken.push(`row ${i}: column count ${cols.length} ≠ header ${header.length}`);
        continue;
      }
      const link = cols[linkCol];
      if (!/^https?:\/\//.test(link.trim()) || /[\n\r]/.test(link)) {
        broken.push(`row ${i}: bad link ${JSON.stringify(link)}`);
      }
    }
    expect(broken.length, `Pinterest broken rows: ${broken.slice(0, 3).join("; ")}`).toBe(0);
  });
});
