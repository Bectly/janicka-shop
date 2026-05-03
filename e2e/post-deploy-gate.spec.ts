import { test, expect } from "@playwright/test";

// Post-deploy smoke gate — anon, no-DB, CI-safe.
//
// Always-on: runs on every `playwright test` invocation against
// PLAYWRIGHT_BASE_URL (defaults to playwright.config.ts baseURL = localhost:3000).
// In CI you can target a deployed URL by exporting PLAYWRIGHT_BASE_URL.
//
// Selective run: npx playwright test --grep @post-deploy-gate
//
// Scope is intentionally narrow: HTTP-level reachability + minimal DOM
// assertion per critical surface. No auth, no cart mutations, no DB writes.

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "";
const FEED_TOKEN =
  process.env.FEED_SECRET ?? process.env.E2E_FEED_TOKEN ?? "";

test.describe("@post-deploy-gate", () => {
  if (BASE_URL) {
    test.use({ baseURL: BASE_URL });
  }

  test("/ — homepage 200, title contains Janička, og:image meta present", async ({
    page,
  }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "homepage HTTP status").toBe(200);
    await expect(page).toHaveTitle(/Janička/i);

    const ogImage = await page
      .locator('meta[property="og:image"]')
      .first()
      .getAttribute("content");
    expect(ogImage, "missing og:image meta").toBeTruthy();
  });

  test("/ — security headers present (CSP or X-Content-Type-Options)", async ({
    request,
  }) => {
    const res = await request.get("/");
    expect(res.status(), "homepage HTTP status").toBe(200);
    const headers = res.headers();
    const hasCsp = Boolean(headers["content-security-policy"]);
    const hasXcto = Boolean(headers["x-content-type-options"]);
    expect(
      hasCsp || hasXcto,
      `expected content-security-policy or x-content-type-options header — got: ${Object.keys(
        headers,
      )
        .filter((h) => h.startsWith("content-") || h.startsWith("x-"))
        .join(", ")}`,
    ).toBe(true);
  });

  test("/products — 200, product card or empty-state visible", async ({
    page,
  }) => {
    const res = await page.goto("/products", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "/products HTTP status").toBe(200);
    await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });

    // Either ≥1 product card link, or an empty-state message — both are valid
    // states for a freshly deployed/empty catalogue.
    const productLinks = page.locator('a[href^="/products/"]');
    const cardCount = await productLinks.count();
    if (cardCount === 0) {
      // Empty catalogue — must surface explicit copy, not a blank page.
      const bodyText = (await page.locator("main").innerText()).toLowerCase();
      expect(
        bodyText,
        "no product cards AND no empty-state copy on /products",
      ).toMatch(/žádné|prázd|brzy|nic|nenalez/);
    } else {
      expect(cardCount).toBeGreaterThanOrEqual(1);
    }
  });

  test("/api/health — 200 with ok:true JSON", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status(), "/api/health HTTP status").toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/);
    const body = (await res.json()) as { ok?: unknown };
    expect(body.ok, "/api/health did not report ok:true").toBe(true);
  });

  test("/rozmery — 200, 'Průvodce velikostmi' visible", async ({ page }) => {
    const res = await page.goto("/rozmery", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "/rozmery HTTP status").toBe(200);
    await expect(
      page.getByText(/Průvodce velikostmi/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("/kosik — 200, cart page renders (empty-state OK)", async ({ page }) => {
    // /kosik is a Czech-friendly alias that redirects to /cart
    // (see next.config.ts redirects). page.goto follows redirects and reports
    // the final response status, which must be 200.
    const res = await page.goto("/kosik", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "/kosik final HTTP status").toBe(200);
    await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
  });

  test("/api/feed/google-merchant — 200 or 401 (never 5xx)", async ({
    request,
  }) => {
    const path = FEED_TOKEN
      ? `/api/feed/google-merchant?token=${encodeURIComponent(FEED_TOKEN)}`
      : "/api/feed/google-merchant";
    const res = await request.get(path);
    const status = res.status();
    expect(
      [200, 401].includes(status),
      `GMC feed returned ${status} — expected 200 or 401, never 5xx`,
    ).toBe(true);
  });
});
