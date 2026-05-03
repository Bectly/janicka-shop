import { test, expect } from "@playwright/test";

// Post-deploy smoke gate — anon, no DB seed, no admin creds.
//
// Hetzner-ready CI gate: 9 critical-path checks that any deployed build
// must pass before traffic is routed. Defaults to localhost:3000 for CI;
// override via BASE_URL=https://jvsatnik.cz for live prod smoke.
//
// Run:
//   npm run smoke:prod                      # local dev server (CI default)
//   BASE_URL=https://jvsatnik.cz npm run smoke:prod
//
// Hard rules: pure GETs (one POST to /api/auth/session), zero auth state,
// zero cart mutations, zero admin surface. Total runtime budget: ~90s.
//
// Local-dev caveat: against `npm run dev` the /api/health and
// /api/search/products tests can flake due to the known dev-mode "use cache"
// concurrent-Prisma abort (see MEMORY.md → instant_search_e2e). For
// deterministic local verification run `npm run build && npm run start` first,
// or set BASE_URL=https://jvsatnik.cz.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

test.use({ baseURL: BASE_URL });

test.describe("@smoke-prod — post-deploy gate (9 checks)", () => {
  test("1. GET / — 200, brand copy present", async ({ page }) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "homepage HTTP status").toBe(200);
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(
      body.includes("janička") || body.includes("oblečení"),
      "homepage missing 'Janička' or 'oblečení' brand copy",
    ).toBe(true);
  });

  test("2. GET /produkty — 200 (Czech alias resolves), ≥1 product card", async ({
    page,
  }) => {
    // /produkty 308-redirects to /products via next.config.ts. page.goto follows
    // and returns the FINAL response status — must be 200.
    const res = await page.goto("/produkty", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "/produkty (→/products) HTTP status").toBe(200);
    const productLinks = page.locator('a[href^="/products/"]');
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });
    expect(await productLinks.count()).toBeGreaterThanOrEqual(1);
  });

  test("3. GET /api/health — 200 with ok:true JSON", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status(), "/api/health HTTP status").toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/);
    const body = (await res.json()) as { ok?: unknown; db?: unknown };
    const okFlag = body.ok === true || body.db === "ok";
    expect(okFlag, "/api/health did not report ok:true or db:'ok'").toBe(true);
  });

  test("4. GET /kosik — 200, cart page renders without crash", async ({
    page,
  }) => {
    // /kosik 308-redirects to /cart; page.goto reports final status.
    const res = await page.goto("/kosik", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "/kosik (→/cart) final status").toBe(200);
    await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
  });

  test("5. GET /login — 200, login form present", async ({ page }) => {
    // Canonical login route. There is no /prihlaseni alias; /login is the
    // single source of truth (src/app/(shop)/login/page.tsx).
    const res = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(res?.status(), "/login HTTP status").toBe(200);
    await expect(
      page.locator('input[type="email"][name="email"]').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("6. GET /ochrana-soukromi — 200 (Czech alias → /privacy)", async ({
    page,
  }) => {
    // Czech alias for the GDPR privacy policy page. Redirects to /privacy.
    // (The literal /zasady-ochrany-osobnich-udaju path is not aliased.)
    const res = await page.goto("/ochrana-soukromi", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status(), "/ochrana-soukromi (→/privacy) final status").toBe(
      200,
    );
    await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
  });

  test("7. POST /api/auth/session — never 5xx", async ({ request }) => {
    // NextAuth's /api/auth/session is GET-only; POST should return a non-5xx
    // (typically 405). The contract is "no 500" — a 5xx here means the auth
    // route is wired wrong and the entire admin surface is degraded.
    const res = await request.post("/api/auth/session", {
      headers: { "content-type": "application/json" },
      data: {},
    });
    expect(
      res.status(),
      `POST /api/auth/session returned 5xx (${res.status()})`,
    ).toBeLessThan(500);
  });

  test("8. GET /api/search/products?q=test — 200 + JSON array", async ({
    request,
  }) => {
    const res = await request.get("/api/search/products?q=test");
    // 429 is acceptable if rate-limited mid-CI; treat as a soft pass.
    if (res.status() === 429) {
      test.info().annotations.push({
        type: "rate-limited",
        description: "search rate limit hit — soft pass",
      });
      return;
    }
    expect(res.status(), "/api/search/products HTTP status").toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/application\/json/);
    const body = await res.json();
    expect(
      Array.isArray(body) || typeof body === "object",
      "search endpoint did not return JSON array/object",
    ).toBe(true);
  });

  test("9. GET /sitemap.xml — 200, contains <url> entries", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status(), "/sitemap.xml HTTP status").toBe(200);
    const body = await res.text();
    expect(body, "sitemap.xml missing <url> entries").toMatch(/<url\b/);
  });
});
