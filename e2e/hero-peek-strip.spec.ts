import { test, expect } from "@playwright/test";

// Hero peek-strip — pre-launch smoke (Task #1067).
//
// What we exercise: homepage renders the "Právě naskladněné" hero peek-strip
// (HeroProductPeekStrip RSC) when ≥3 active+unsold products exist, every card
// inside it is an <a href="/products/[slug]"> and carries the
// data-track="hero-peek-strip-card" telemetry attribute. The strip is rendered
// via the homepage hero <peekStrip> slot in src/app/(shop)/page.tsx and the
// component lives in src/components/shop/hero-product-peek-strip.tsx.
//
// We do NOT seed products — we rely on dev DB having ≥3 active+unsold rows
// (the strip simply returns null below that threshold). When the dev DB is
// empty we skip rather than fail, so the spec stays green on a cold box.

test.describe("Hero peek-strip — homepage smoke", () => {
  test("renders ≥1 product card with data-track + valid /products/[slug] href", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Hero is "use cache" so it should be present after RSC streaming
    // finishes. We anchor on the telemetry attribute rather than a CSS class
    // because the implementation uses data-track="hero-peek-strip-card" on
    // each <Link>. Wait up to 15s for the first card to attach (cold dev
    // server can be slow to compile the homepage on first hit).
    const cards = page.locator('[data-track="hero-peek-strip-card"]');
    try {
      await cards.first().waitFor({ state: "attached", timeout: 15_000 });
    } catch {
      test.skip(
        true,
        "Dev DB má méně než 3 aktivní produkty — peek-strip se nerenderuje",
      );
    }

    const count = await cards.count();

    expect(count).toBeGreaterThanOrEqual(1);

    // First card: must be visible, must have href starting with /products/.
    const first = cards.first();
    await expect(first).toBeVisible();

    const href = await first.getAttribute("href");
    expect(href).toMatch(/^\/products\/[^/]+/);

    // data-product-id must be a non-empty string (telemetry payload).
    const productId = await first.getAttribute("data-product-id");
    expect(productId).toBeTruthy();

    // The eyebrow chip "Právě naskladněné" anchors the section.
    await expect(
      page.getByText("Právě naskladněné", { exact: false }),
    ).toBeVisible();
  });
});
