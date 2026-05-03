import { test, expect } from "@playwright/test";

/**
 * Functional bug hunt — prod read-only probes (cycle #5184, task #958).
 *
 * Opt-in via PROD_HUNT=1 (otherwise skipped — prevents accidental hits
 * on prod from default `playwright test` runs).
 *
 *   PROD_HUNT=1 npx playwright test e2e/bug-hunt-2026-05-03.spec.ts \
 *     --project=chromium --reporter=list
 *
 * Each probe corresponds to a finding in
 * docs/qa-reports/2026-05-03-functional-hunt/REPORT.md. Tests with
 * `test.fixme()` are reproductions of *open* bugs — they are expected
 * to fail until Bolt fixes them; the fixme marker keeps CI green while
 * preserving the regression check.
 */

const PROD_BASE =
  process.env.PROD_HUNT_URL ?? "https://www.jvsatnik.cz";

test.skip(
  process.env.PROD_HUNT !== "1",
  "Prod bug-hunt is opt-in (PROD_HUNT=1) — see header.",
);

test.use({ baseURL: PROD_BASE });

test.describe("Functional bug hunt — prod (jvsatnik.cz)", () => {
  // ─── P0 findings ──────────────────────────────────────────────────────

  test.fixme(
    "F1 (P0) — invalid product slug returns HTTP 200 instead of 404",
    async ({ request }) => {
      // notFound() in src/app/(shop)/products/[slug]/page.tsx is being
      // served with HTTP 200 + cache-control public s-maxage=60. SEO
      // disaster — Google will index every typo as a duplicate of home.
      const res = await request.get(
        "/products/non-existent-foo-bar-12345-trace-c5184",
      );
      expect(res.status(), "should be 404").toBe(404);
    },
  );

  test.fixme(
    "F2 (P0) — POST /api/cart/capture returns 404 on prod (route not deployed)",
    async ({ request }) => {
      // Route file landed in commit d9f0613 (C5163) and was patched in
      // C5166 to remove `runtime='nodejs'`. Production still 404s.
      // Blocks abandoned-cart wiring (Manager directive J22 / Bolt).
      const res = await request.post("/api/cart/capture", {
        data: {
          email: "qa-trace@example.com",
          cartItems: [
            { productId: "x", name: "y", price: 10 },
          ],
          cartTotal: 10,
          marketingConsent: false,
        },
      });
      expect(
        res.status(),
        `expected 200 or 4xx-validation, got ${res.status()}`,
      ).not.toBe(404);
    },
  );

  test.fixme(
    "F3 (P0) — POST /api/products/view returns 404 on prod",
    async ({ request }) => {
      // Same deploy gap as F2 — both routes added in d9f0613 (C5163)
      // are not present in the production bundle.
      const res = await request.post("/api/products/view", {
        data: { productId: "x", name: "y", price: 10 },
      });
      expect(res.status()).not.toBe(404);
    },
  );

  // ─── P1 findings ──────────────────────────────────────────────────────

  test.fixme(
    "F4 (P1) — invalid PDP soft-404 served with cache-control public s-maxage=60",
    async ({ request }) => {
      // Even if HTTP status is fixed, the CDN cache header on the
      // not-found response is `public, s-maxage=60` (homepage default).
      // Should be `private, no-store` or `s-maxage=0` so a typo URL
      // does not get cached for a minute on every Cloudflare edge.
      const res = await request.get(
        "/products/non-existent-foo-bar-67890-trace-c5184",
      );
      const cc = res.headers()["cache-control"] ?? "";
      expect(
        cc,
        `not-found cache-control should not be public/s-maxage; got "${cc}"`,
      ).not.toMatch(/public.*s-maxage=[1-9]/);
    },
  );

  test.fixme(
    "F5 (P1) — invalid PDP renders generic homepage <title> (no not-found title)",
    async ({ page }) => {
      // not-found.tsx renders 'Tenhle kousek už není k mání' but the
      // <title> is left as the default `Janička — second hand …`.
      // Bad UX (browser tab) + bad SEO (snippet looks like a duplicate).
      await page.goto("/products/non-existent-foo-bar-trace-title-c5184");
      await expect(page).not.toHaveTitle(
        /^Janička — second hand & vintage móda \| značkové oblečení levně$/,
      );
    },
  );

  // ─── P2 / passing baseline probes ─────────────────────────────────────

  test("P-1 — homepage 200 + Czech UI strings render", async ({
    page,
  }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).toMatch(/košík|novinky|hledat|janička/);
  });

  test("P-2 — /products: ≥1 card renders, no /api/* 5xx during load", async ({
    page,
  }) => {
    const apiFailures: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/") && r.status() >= 500) {
        apiFailures.push(`${r.status()} ${r.url()}`);
      }
    });
    const res = await page.goto("/products", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
    await expect(
      page.locator('a[href^="/products/"]').first(),
    ).toBeVisible({ timeout: 15_000 });
    expect(apiFailures).toHaveLength(0);
  });

  test("P-3 — PDP for known live slug: 200, AddToCart button visible", async ({
    page,
  }) => {
    await page.goto("/products", { waitUntil: "domcontentloaded" });
    const firstHref = await page
      .locator('a[href^="/products/"]')
      .first()
      .getAttribute("href");
    expect(firstHref).toBeTruthy();
    const res = await page.goto(firstHref!, {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("button", { name: /Přidat do košíku|Vyprodáno/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("P-4 — /api/search/products: returns full client-side index (≥1 item)", async ({
    request,
  }) => {
    // Sanity check that the MiniSearch index endpoint works. Note: the
    // ?q= param is intentionally ignored here — filtering happens
    // client-side. (Documented in the route docstring.)
    const res = await request.get("/api/search/products?q=anything");
    expect(res.status()).toBe(200);
    const data = (await res.json()) as Array<{ id: string }>;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test("P-5 — /cart empty state renders Czech 'Košík je prázdný'", async ({
    page,
  }) => {
    const res = await page.goto("/cart", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
    await expect(
      page.getByText(/Košík je prázdný/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("P-6 — /checkout returns 200 (no infinite Načítání)", async ({
    page,
  }) => {
    // Sage C5180 reported /checkout hangs on 'Načítání'. This probe
    // confirms the route loads at all; deeper hang detection requires
    // an authenticated cart fixture (out of scope for read-only hunt).
    const res = await page.goto("/checkout", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
  });

  test("P-7 — /login (customer) returns 200", async ({ page }) => {
    const res = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBe(200);
  });

  test("P-8 — /oblibene wishlist page returns 200", async ({ page }) => {
    const res = await page.goto("/oblibene", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
  });

  test("P-9 — /admin redirects (307) for unauthenticated user", async ({
    request,
  }) => {
    const res = await request.get("/admin", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
  });

  test("P-10 — robots.txt disallows /admin", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    expect(await res.text()).toMatch(/Disallow:\s*\/admin/);
  });

  test("P-11 — sitemap.xml: 200 + non-trivial size (≥10kB)", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.length).toBeGreaterThan(10_000);
    expect(body).toMatch(/<urlset/);
  });

  test("P-12 — /products with extreme/garbage filter combo still returns 200", async ({
    request,
  }) => {
    const res = await request.get(
      "/products?brand=NonExistentBrand&size=999&minPrice=99999&maxPrice=abc",
    );
    expect(res.status()).toBe(200);
  });

  test("P-13 — /api/health: 200, db+redis+email all 'ok'", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      db: string;
      redis: string;
      email: string;
    };
    expect(json.ok).toBe(true);
    expect(json.db).toBe("ok");
    expect(json.redis).toBe("ok");
    expect(json.email).toBe("ok");
  });

  test("P-14 — POST /api/wishlist/sync without session returns 401 JSON (not HTML 404)", async ({
    request,
  }) => {
    // Regression guard: this endpoint must always reach the handler so
    // unauthenticated callers get the documented 401 JSON response, not
    // a Next.js 404 HTML fallback (which would mean the route file is
    // missing from the build, like F2/F3).
    const res = await request.post("/api/wishlist/sync", {
      data: { productIds: [] },
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(401);
    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toMatch(/application\/json/);
  });

  test("P-15 — non-existent route returns proper 404", async ({
    request,
  }) => {
    const res = await request.get("/this-page-does-not-exist-trace-c5184");
    expect(res.status()).toBe(404);
  });
});
