import { test, expect } from "@playwright/test";

// Cart reservation TTL — pre-launch smoke (Task #1067).
//
// What we exercise: adding the first homepage product to the cart sets a
// reservedUntil ISO timestamp, the /cart row shows a live "MM:SS" countdown
// badge, and the reservation persists across a page reload (zustand persist
// key "janicka-cart" + server-side Product.reservedUntil column). The
// sliding-refresh + soft-expire recovery flow is covered in
// cart-reservation-sliding.spec.ts; this spec is the simpler "reservation
// exists, item still in cart after F5" smoke.

test.describe("Cart reservation — TTL set + persist across reload", () => {
  test("ATC sets reservation, countdown visible, item survives page reload", async ({
    page,
  }) => {
    await page.goto("/");

    const firstProductLink = page.locator('a[href^="/products/"]').first();
    await expect(firstProductLink).toBeVisible({ timeout: 10_000 });
    const productHref = await firstProductLink.getAttribute("href");
    if (!productHref) test.skip(true, "Žádný produktový odkaz na homepage");

    await firstProductLink.click();
    await page.waitForURL(/\/products\/.+/);

    const addToCart = page.getByRole("button", { name: /P.idat do ko..ku/i });
    await expect(addToCart).toBeVisible();
    await addToCart.click();

    // After-add: persistent ATC swaps to "Přidáno do košíku" / "Již v košíku".
    await expect(
      page.getByRole("button", { name: /P.id.no do ko..ku|Ji. v ko..ku/i }),
    ).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /^Ko..k$/i })).toBeVisible();

    // Countdown badge — useCountdown hook renders MM:SS once reservedUntil is
    // populated. Permissive regex (M:SS-shaped) avoids coupling to the
    // configured RESERVATION_MINUTES value.
    await expect(
      page.locator("text=/\\d{1,2}:\\d{2}/").first(),
    ).toBeVisible({ timeout: 5_000 });

    // Persisted reservedUntil — read from zustand-persisted localStorage key.
    const reservedUntilBefore = await page.evaluate(() => {
      const raw = window.localStorage.getItem("janicka-cart");
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        return parsed?.state?.items?.[0]?.reservedUntil ?? null;
      } catch {
        return null;
      }
    });
    expect(reservedUntilBefore).toBeTruthy();
    expect(new Date(reservedUntilBefore!).getTime()).toBeGreaterThan(Date.now());

    // Reload — the row must still be present (item didn't vanish) and a
    // countdown badge must still render.
    await page.reload();
    await expect(page.getByRole("heading", { name: /^Ko..k$/i })).toBeVisible();
    await expect(
      page.locator("text=/\\d{1,2}:\\d{2}/").first(),
    ).toBeVisible({ timeout: 5_000 });

    // The Trash CTA "Odebrat z košíku" is per-row → its presence proves the
    // row survived the reload (empty cart shows the "Košík je prázdný"
    // heading instead and has no Trash button).
    await expect(
      page.getByRole("button", { name: /Odebrat z ko..ku/i }),
    ).toBeVisible();
  });
});
