import { test, expect } from "@playwright/test";

// Cart golden path: PDP add → /cart shows item → remove → empty-cart state
// → re-add from PDP → reload to assert localStorage persistence (zustand
// persist key "janicka-cart"). Second-hand semantics: every product has
// stock=1 and the cart never stacks, so quantity controls don't exist in
// the UI — qty assertions are intentionally omitted (see cart-store.ts).

test.describe("Cart flow", () => {
  test("add → remove → empty-state → re-add → persist across reload", async ({
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

    // After-add state — either "Přidáno do košíku" toast button label or
    // the persistent "Již v košíku" disabled state.
    await expect(
      page.getByRole("button", { name: /P.id.no do ko..ku|Ji. v ko..ku/i }),
    ).toBeVisible();

    await page.goto("/cart");

    // Cart heading proves we're on the populated view (not the empty branch).
    await expect(page.getByRole("heading", { name: /^Ko..k$/i })).toBeVisible();

    // The item row carries a Trash button labelled "Odebrat z košíku".
    const removeBtn = page.getByRole("button", {
      name: /Odebrat z ko..ku/i,
    });
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    // Empty state: heading "Košík je prázdný" + CTA Link → /products.
    await expect(
      page.getByRole("heading", { name: /Ko..k je pr.zdn./i }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole("link", { name: /Prohl.dnout kolekci/i }),
    ).toHaveAttribute("href", "/products");

    // Re-add from the same PDP — isInCart is false again so button is enabled.
    await page.goto(productHref!);
    const reAdd = page.getByRole("button", { name: /P.idat do ko..ku/i });
    await expect(reAdd).toBeEnabled();
    await reAdd.click();
    await expect(
      page.getByRole("button", { name: /P.id.no do ko..ku|Ji. v ko..ku/i }),
    ).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: /^Ko..k$/i })).toBeVisible();

    // Persistence proof — zustand persist writes to localStorage under
    // "janicka-cart"; reload and the item must still be there.
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("janicka-cart"),
    );
    expect(stored).toBeTruthy();
    expect(stored!).toContain('"items"');

    await page.reload();
    await expect(page.getByRole("heading", { name: /^Ko..k$/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Odebrat z ko..ku/i }),
    ).toBeVisible();
  });
});
