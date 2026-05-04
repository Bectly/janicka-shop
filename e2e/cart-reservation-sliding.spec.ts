import { test, expect } from "@playwright/test";

// Sliding reservation refresh + soft-expire recovery.
//
// Coverage:
//  1. Add item → /cart shows live countdown badge (heartbeat keeps it ticking).
//  2. Force the row's reservedUntil to a past timestamp via localStorage —
//     reload — assert "Rezervace vypršela" + "Obnovit rezervaci" CTA appear.
//  3. Click "Obnovit rezervaci" — same visitor still owns the slot in DB
//     (extendReservations only nulls out when sold/inactive/other-visitor),
//     so reserveProduct re-claims it and the soft-expire UI clears.
//
// The race-loss path (reserved_by_other / sold) is not exercised here because
// it requires a second visitor session driving the DB; that path is covered
// by the unit-level reservation tests (action-level) and the action's own
// branch coverage. This E2E focuses on the recovery flow the user sees.

test.describe("Cart reservation — sliding TTL + soft-expire recovery", () => {
  test("expired reservation surfaces obnovit CTA and recovers on click", async ({
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

    await expect(
      page.getByRole("button", { name: /P.id.no do ko..ku|Ji. v ko..ku/i }),
    ).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /^Ko..k$/i })).toBeVisible();

    // Live countdown badge — the heartbeat-driven extend keeps reservedUntil
    // populated, so a "MM:SS" badge must render on the row. Match a permissive
    // pattern (anything M:SS-shaped) to avoid coupling to RESERVATION_MINUTES.
    await expect(
      page.locator("text=/\\d{1,2}:\\d{2}/").first(),
    ).toBeVisible({ timeout: 5_000 });

    // Force the persisted cart's reservedUntil into the past so the row
    // renders the expired state on reload — without us needing to wait the
    // full 15-minute window.
    const past = new Date(Date.now() - 60_000).toISOString();
    await page.evaluate((pastIso) => {
      const raw = window.localStorage.getItem("janicka-cart");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.state?.items?.[0]) {
        parsed.state.items[0].reservedUntil = pastIso;
        window.localStorage.setItem("janicka-cart", JSON.stringify(parsed));
      }
    }, past);

    await page.reload();
    await expect(page.getByRole("heading", { name: /^Ko..k$/i })).toBeVisible();

    // Soft-expire surface: passive badge + obnovit CTA.
    await expect(page.getByText(/Rezervace vypr.ela/i).first()).toBeVisible();
    const retryBtn = page.getByRole("button", {
      name: /Obnovit rezervaci/i,
    });
    await expect(retryBtn).toBeVisible();

    // Click → server reserveProduct re-claims (visitor still owns DB slot
    // unless someone else grabbed it; in this test no concurrent buyer).
    await retryBtn.click();

    // After success, "Rezervace vypršela" + obnovit CTA must disappear and
    // a fresh countdown badge re-render.
    await expect(retryBtn).toBeHidden({ timeout: 5_000 });
    await expect(
      page.locator("text=/\\d{1,2}:\\d{2}/").first(),
    ).toBeVisible();
  });
});
