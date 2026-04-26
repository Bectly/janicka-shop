import { test, expect } from "@playwright/test";

// Apr30 launch gate — fires *after* devloop #620 lands (Vercel env-var fix
// for trailing-newline NEXT_PUBLIC_SITE_URL). Proves all 12 callsites that
// emit absolute URLs (GMC + Pinterest feeds, sitemap, robots, homepage
// JSON-LD, PDP JSON-LD) now produce clean absolute jvsatnik.cz URLs.
//
// GATE: opt-in via PROD_LAUNCH=1, baseURL=https://www.jvsatnik.cz.
//
//   PROD_LAUNCH=1 npx playwright test e2e/prod-launch-gate.spec.ts
//
// SAFETY: read-only GETs, no auth, no mutations.

const PROD_BASE = process.env.PROD_LAUNCH_URL ?? "https://www.jvsatnik.cz";

test.skip(
  process.env.PROD_LAUNCH !== "1",
  "Prod launch gate is opt-in (PROD_LAUNCH=1) — see header.",
);

test.use({ baseURL: PROD_BASE });

const ABSOLUTE_JVSATNIK = /^https:\/\/www\.jvsatnik\.cz\//;
const WHITESPACE_IN_URL = /[\s\n\r\t]/;

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
    const parsed = JSON.parse(raw) as unknown;
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

function assertCleanProdUrl(value: unknown, label: string): void {
  expect(typeof value, `${label} must be a string`).toBe("string");
  const url = value as string;
  expect(
    WHITESPACE_IN_URL.test(url),
    `${label} contains whitespace/control char: ${JSON.stringify(url)}`,
  ).toBe(false);
  expect(
    url,
    `${label} must be absolute https://www.jvsatnik.cz/...`,
  ).toMatch(ABSOLUTE_JVSATNIK);
}

test.describe("Prod launch gate — env-var fix verification", () => {
  test("GMC feed: first 5 <g:link> are clean absolute jvsatnik.cz", async ({
    request,
  }) => {
    const res = await request.get("/api/feed/google-merchant");
    expect(res.status()).toBe(200);
    const xml = await res.text();

    const links = Array.from(xml.matchAll(/<g:link>([^<]*)<\/g:link>/g)).map(
      (m) => m[1],
    );
    expect(links.length, "GMC feed must expose at least one <g:link>").toBeGreaterThan(0);

    const sample = links.slice(0, 5);
    expect(sample.length, "expected at least 5 <g:link> entries to sample").toBe(
      Math.min(5, links.length),
    );

    for (const [i, link] of sample.entries()) {
      assertCleanProdUrl(link, `GMC <g:link>[${i}]`);
    }
  });

  test("Pinterest feed: first 5 link column rows are clean absolute jvsatnik.cz", async ({
    request,
  }) => {
    const res = await request.get("/api/feed/pinterest");
    expect(res.status()).toBe(200);
    const tsv = await res.text();

    const lines = tsv.split(/\r?\n/).filter((l) => l.length > 0);
    expect(lines.length, "Pinterest TSV must have header + at least one row").toBeGreaterThanOrEqual(2);

    const header = lines[0].split("\t");
    const linkCol = header.indexOf("link");
    expect(linkCol, "Pinterest header missing link column").toBeGreaterThanOrEqual(0);

    const dataRows = lines.slice(1, 6);
    expect(dataRows.length, "expected at least 5 Pinterest data rows").toBeGreaterThan(0);

    for (const [i, row] of dataRows.entries()) {
      const cols = row.split("\t");
      expect(
        cols.length,
        `Pinterest row ${i + 1} column count ${cols.length} ≠ header ${header.length} (likely embedded \\n in URL)`,
      ).toBe(header.length);
      assertCleanProdUrl(cols[linkCol], `Pinterest row ${i + 1} link`);
    }
  });

  test("/sitemap.xml: every <loc> is absolute jvsatnik.cz", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();

    const locs = Array.from(xml.matchAll(/<loc>([^<]*)<\/loc>/g)).map((m) => m[1]);
    expect(locs.length, "sitemap.xml must expose at least one <loc>").toBeGreaterThan(0);

    for (const [i, loc] of locs.entries()) {
      assertCleanProdUrl(loc, `sitemap <loc>[${i}]`);
    }
  });

  test("/robots.txt: Sitemap line is absolute jvsatnik.cz", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();

    const sitemapLines = body
      .split(/\r?\n/)
      .filter((l) => /^sitemap\s*:/i.test(l));
    expect(sitemapLines.length, "robots.txt must declare at least one Sitemap").toBeGreaterThan(0);

    for (const [i, line] of sitemapLines.entries()) {
      const url = line.replace(/^sitemap\s*:\s*/i, "").trim();
      assertCleanProdUrl(url, `robots.txt Sitemap[${i}]`);
    }
  });

  test("/ homepage JSON-LD: Organization.url + WebSite.url absolute jvsatnik.cz", async ({
    page,
  }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);

    const nodes = await parseJsonLd(page);
    expect(nodes.length, "homepage missing JSON-LD blocks").toBeGreaterThan(0);

    const org = findType(nodes, "Organization");
    expect(org, "homepage missing Organization schema").toBeTruthy();
    assertCleanProdUrl(org!.url, "Organization.url");

    const site = findType(nodes, "WebSite");
    expect(site, "homepage missing WebSite schema").toBeTruthy();
    assertCleanProdUrl(site!.url, "WebSite.url");
  });

  test("/products/[active] JSON-LD: Product.url + offers.url absolute jvsatnik.cz", async ({
    page,
  }) => {
    await page.goto("/products", { waitUntil: "domcontentloaded" });
    const firstHref = await page
      .locator('a[href^="/products/"]')
      .first()
      .getAttribute("href");
    expect(firstHref, "no product link found on /products listing").toBeTruthy();

    const res = await page.goto(firstHref!, { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);

    const nodes = await parseJsonLd(page);
    const product = findType(nodes, "Product");
    expect(product, "PDP missing Product schema").toBeTruthy();

    assertCleanProdUrl(product!.url, "Product.url");

    const offers = product!.offers as Record<string, unknown> | undefined;
    expect(offers, "Product.offers missing").toBeTruthy();
    assertCleanProdUrl(offers!.url, "Offer.url");
  });
});
