import { test, expect } from "@playwright/test";

// Quick-view modal — pre-launch smoke (Task #1067).
//
// What we exercise: clicking the per-card "Rychlý náhled" button on /products
// opens the QuickView Dialog (base-ui Dialog primitive), the modal renders
// product image + title + price + AddToCartButton, Escape closes it, and the
// focus trap keeps tab focus inside the popup while open.
//
// We use desktop viewport so the QuickViewButton in product-card.tsx (whose
// hover-reveal CSS only flips opacity but the element is always in the DOM)
// is interactable. We force-click the button to bypass parent <Link> hit
// shadowing — QuickViewButton already calls e.preventDefault/stopPropagation
// inside its onClick handler, so navigation is suppressed.

test.describe("Quick-view modal — open + content + close + focus trap", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("opens modal, shows image+title+price+ATC, Escape closes, focus trapped", async ({
    page,
  }) => {
    await page.goto("/products");

    // QuickViewButton renders aria-label="Rychlý náhled" inside every card.
    const quickViewBtn = page
      .getByRole("button", { name: /Rychlý náhled/i })
      .first();
    await expect(quickViewBtn).toBeAttached({ timeout: 10_000 });

    // The button is opacity:0 group-hover:opacity-100 on desktop; force-click
    // is required to bypass the visual hover gate, but the onClick handler is
    // wired regardless of CSS visibility.
    await quickViewBtn.click({ force: true });

    // Popup mounts via base-ui Dialog.Portal. We anchor on
    // data-slot="quick-view-popup" set on DialogPrimitive.Popup.
    const popup = page.locator('[data-slot="quick-view-popup"]');
    await expect(popup).toBeVisible({ timeout: 10_000 });

    // The body content can mount in two states: loading (spinner + "Připravuji
    // kousek") and loaded (full body). We wait for the loaded body — title is
    // a DialogPrimitive.Title (heading-ish), price contains "Kč".
    await expect(
      popup.locator('img').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Title text — the QuickViewBody renders an h2-ish title with the
    // product name. We just assert *some* non-empty heading-class text.
    const titleEl = popup.locator(
      "h2, [data-slot=quick-view-popup] .font-heading",
    );
    await expect(titleEl.first()).toBeVisible();

    // Price block — formatPrice renders "<n> Kč".
    await expect(popup.getByText(/Kč/).first()).toBeVisible();

    // ATC inside the modal — AddToCartButton renders "Přidat do košíku" or a
    // disabled "Vyprodáno" / size-pick state. Either way at least one button
    // tied to the cart action must be present.
    const atcInsideModal = popup.getByRole("button", {
      name: /P.idat do ko..ku|Vyprod.no|Vyber|Vyberte/i,
    });
    await expect(atcInsideModal.first()).toBeVisible();

    // Focus trap — base-ui Dialog should keep focus inside the popup while
    // open. Tab a few times and assert that the active element is still
    // contained within data-slot="quick-view-popup".
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const popupEl = document.querySelector(
          '[data-slot="quick-view-popup"]',
        );
        const active = document.activeElement;
        if (!popupEl || !active) return false;
        return popupEl.contains(active);
      });
      expect(inside, `focus escaped popup after Tab #${i + 1}`).toBe(true);
    }

    // Escape closes — popup must be hidden / detached.
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden({ timeout: 5_000 });
  });
});
