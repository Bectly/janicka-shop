import { test, expect } from "@playwright/test";

// PDP golden path: gallery renders ≥1 image, optional measurements grid
// (only when product.measurements has chest/waist/length keys — gracefully
// skipped otherwise), wishlist toggle flips its accessible name, and the
// add-to-cart CTA flips to the "added/in cart" state. Inline selectors,
// no Page Object, runs against the dev server (playwright.config webServer).

test.describe("PDP", () => {
  test("gallery, measurements, wishlist toggle, add-to-cart", async ({
    page,
  }) => {
    await page.goto("/products");

    const firstProduct = page.locator('a[href^="/products/"]').first();
    await expect(firstProduct).toBeVisible({ timeout: 10_000 });
    await firstProduct.click();
    await page.waitForURL(/\/products\/.+/);

    // Gallery — at least one image with a non-empty alt is rendered. The
    // gallery uses next/image so we look at <img> inside the main column.
    const galleryImages = page.locator("main img");
    await expect(galleryImages.first()).toBeVisible({ timeout: 10_000 });
    expect(await galleryImages.count()).toBeGreaterThanOrEqual(1);

    // Measurements grid — only present when hasMeasurements() returns true
    // (chest/waist/length/etc. populated). Skip gracefully when missing.
    const measurementsHeader = page.getByText("Rozměry kusu", { exact: true });
    if (await measurementsHeader.isVisible().catch(() => false)) {
      const grid = measurementsHeader.locator(
        "xpath=ancestor::div[contains(@class,'rounded-xl')][1]",
      );
      await expect(grid).toBeVisible();
    } else {
      test.info().annotations.push({
        type: "skip-measurements",
        description: "Produkt nemá vyplněné rozměry — sekce se nevykresluje.",
      });
    }

    // Wishlist (detail variant) — aria-label flips between
    // "Přidat do oblíbených" and "Odebrat z oblíbených". The card variant
    // also exists on related-products; we grab the detail one inside main.
    const wishlistAdd = page
      .getByRole("button", { name: /^P.idat do obl.ben.ch$/i })
      .first();
    await expect(wishlistAdd).toBeVisible();
    await wishlistAdd.click();
    await expect(
      page.getByRole("button", { name: /^Odebrat z obl.ben.ch$/i }).first(),
    ).toBeVisible();

    // Add to cart — server action reserves the item, then the button label
    // flips to "Přidáno do košíku" (toast variant) or "Již v košíku" (sticky).
    const addToCart = page.getByRole("button", { name: /P.idat do ko..ku/i });
    await expect(addToCart).toBeEnabled();
    await addToCart.click();
    await expect(
      page.getByRole("button", { name: /P.id.no do ko..ku|Ji. v ko..ku/i }),
    ).toBeVisible({ timeout: 5_000 });

    // SR live-region announcement is the canonical "added" signal; check it
    // exists and is wired with role=status (content may have already cleared).
    await expect(page.locator('[role="status"][aria-live="polite"]').first())
      .toBeAttached();
  });
});
