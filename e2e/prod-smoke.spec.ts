import { test, expect, type ConsoleMessage } from "@playwright/test";

// Live production smoke (#585 — pre-Apr30 GMC/Doppl launch insurance).
// Read-only critical-path coverage on the deployed jvsatnik.cz build. The
// rest of the e2e suite hits localhost:3000; a silent prod-only break (env
// drift, R2 misconfig, CSP regression on Comgate iframe, missing manifest,
// 5xx on /api/feed/*) would not surface until users hit it. This spec
// closes the gap.
//
// GATE: opt-in via PROD_SMOKE=1. Skipped by default so the standard
// `playwright test` run never touches prod (CI would burn requests against
// the live store and pollute analytics). Run via:
//
//   npm run smoke:prod
//
// SAFETY: every assertion is read-only — no auth, no checkout, no cart
// mutations, no admin surface. Pure GET requests + DOM assertions on
// public pages and feed endpoints.

const PROD_BASE = process.env.PROD_SMOKE_URL ?? "https://jvsatnik.cz";
const FEED_TOKEN =
  process.env.FEED_SECRET ?? process.env.E2E_FEED_TOKEN ?? "";

test.skip(
  process.env.PROD_SMOKE !== "1",
  "Prod smoke is opt-in (PROD_SMOKE=1) — see e2e/prod-smoke.spec.ts header.",
);

test.use({ baseURL: PROD_BASE });

function feedPath(path: string): string {
  return FEED_TOKEN
    ? `${path}?token=${encodeURIComponent(FEED_TOKEN)}`
    : path;
}

test.describe("Prod smoke — jvsatnik.cz read-only", () => {
  test("homepage: 200, title, OG image meta resolves", async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });

    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "homepage HTTP status").toBe(200);

    await expect(page).toHaveTitle(/Janička/i);

    // Sentry/error-boundary fallback would render a generic message body.
    // Cheap proxy: ensure the site's actual nav/footer content is present.
    const body = await page.locator("body").innerText();
    expect(
      body.toLowerCase(),
      "homepage body looks like an error fallback (no Czech UI strings present)",
    ).toMatch(/janička|košík|kolekce|novinky|oblíbené|hledat/i);

    // OG image meta resolves (200 + image/* content-type). Failure here
    // tanks Pinterest/Facebook/Open Graph previews.
    const ogContent = await page
      .locator('meta[property="og:image"]')
      .first()
      .getAttribute("content");
    expect(ogContent, "missing og:image meta").toBeTruthy();
    const ogUrl = ogContent!.startsWith("http")
      ? ogContent!
      : new URL(ogContent!, PROD_BASE).toString();
    const ogRes = await request.get(ogUrl);
    expect(ogRes.status(), `og:image ${ogUrl} not 200`).toBe(200);
    expect(ogRes.headers()["content-type"] ?? "").toMatch(/^image\//);

    expect(errors, `JS errors on homepage: ${errors.join(" | ")}`).toHaveLength(
      0,
    );
  });

  test("/products: 200, ≥1 product card rendered, no /api/* 5xx", async ({
    page,
  }) => {
    const apiFailures: string[] = [];
    page.on("response", (r) => {
      const url = r.url();
      if (url.includes("/api/") && r.status() >= 500) {
        apiFailures.push(`${r.status()} ${url}`);
      }
    });

    const res = await page.goto("/products", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "/products HTTP status").toBe(200);

    // ProductCard renders as <a href="/products/<slug>"> (no <article> tag in
    // current implementation — selector matches the same pattern e2e/pdp.spec.ts
    // uses). At least one card must render or the listing is broken.
    const productLinks = page.locator('a[href^="/products/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });
    expect(await productLinks.count()).toBeGreaterThanOrEqual(1);

    expect(
      apiFailures,
      `/api/* 5xx during /products load: ${apiFailures.join(", ")}`,
    ).toHaveLength(0);
  });

  test("PDP: 200, Product JSON-LD present, gallery images on R2", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });

    // Discover first available product slug from the listing — read-only.
    await page.goto("/products", { waitUntil: "domcontentloaded" });
    const firstHref = await page
      .locator('a[href^="/products/"]')
      .first()
      .getAttribute("href");
    expect(firstHref, "no product link found on /products").toBeTruthy();

    const pdpRes = await page.goto(firstHref!, {
      waitUntil: "domcontentloaded",
    });
    expect(pdpRes?.status(), `PDP ${firstHref} HTTP status`).toBe(200);

    // At least one application/ld+json block should parse to a Product schema.
    const ldJsonBlocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(
      ldJsonBlocks.length,
      "no application/ld+json blocks on PDP",
    ).toBeGreaterThan(0);

    const hasProductSchema = ldJsonBlocks.some((raw) => {
      try {
        const parsed = JSON.parse(raw);
        const nodes = Array.isArray(parsed) ? parsed : [parsed];
        return nodes.some((n) => n && n["@type"] === "Product");
      } catch {
        return false;
      }
    });
    expect(hasProductSchema, "no Product JSON-LD found on PDP").toBe(true);

    // Gallery images must point at the R2 public alias — anything else means
    // the R2 migration regressed and we're serving from the old UploadThing
    // host (or worse, a broken local-dev path).
    const galleryImages = page.locator("main img");
    await expect(galleryImages.first()).toBeVisible({ timeout: 10_000 });
    const srcs = await galleryImages.evaluateAll((nodes) =>
      (nodes as HTMLImageElement[]).map((n) => n.src),
    );
    const r2Sources = srcs.filter((s) =>
      s.includes("pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev"),
    );
    expect(
      r2Sources.length,
      `no R2-hosted images in gallery — saw: ${srcs.slice(0, 3).join(", ")}`,
    ).toBeGreaterThan(0);

    expect(errors, `JS errors on PDP: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("/cart: 200, empty-state copy renders", async ({ page }) => {
    const res = await page.goto("/cart", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "/cart HTTP status").toBe(200);

    // Empty state — fresh visitor has no Zustand-persisted cart, so the
    // "Košík je prázdný" headline (src/app/(shop)/cart/page.tsx:170) renders.
    await expect(
      page.getByText(/Košík je prázdný/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("/api/feed/google-merchant: 200, valid <rss>, ≥1 <item>", async ({
    request,
  }) => {
    const res = await request.get(feedPath("/api/feed/google-merchant"));
    expect(res.status(), "GMC feed status").toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/xml/i);

    const body = await res.text();
    expect(body, "GMC feed missing <rss> root").toMatch(/<rss\b/);
    expect(
      body.match(/<item\b/g)?.length ?? 0,
      "GMC feed has zero <item> entries",
    ).toBeGreaterThan(0);
  });

  test("/api/feed/pinterest: 200, TSV header matches Pinterest spec", async ({
    request,
  }) => {
    const res = await request.get(feedPath("/api/feed/pinterest"));
    expect(res.status(), "Pinterest feed status").toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(
      /tab-separated-values/i,
    );

    const body = await res.text();
    const lines = body.split("\n").filter((l) => l.length > 0);
    expect(
      lines.length,
      "Pinterest feed must have header + ≥1 product row",
    ).toBeGreaterThanOrEqual(2);

    const header = lines[0].split("\t");
    for (const col of [
      "id",
      "title",
      "description",
      "link",
      "image_link",
      "price",
      "availability",
    ]) {
      expect(
        header,
        `Pinterest header missing column "${col}"`,
      ).toContain(col);
    }
  });

  test("/robots.txt: 200, disallows /admin", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status(), "/robots.txt status").toBe(200);
    const body = await res.text();
    expect(body, "robots.txt missing Disallow: /admin rule").toMatch(
      /Disallow:\s*\/admin/,
    );
  });
});
