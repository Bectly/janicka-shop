import { test, expect } from "@playwright/test";

// End-to-end: add to cart → checkout (accordion) → mock payment gate →
// order page. Requires PAYMENT_PROVIDER=mock + NEXT_PUBLIC_PAYMENT_PROVIDER=mock;
// if the test-mode banner is missing on /checkout the test is skipped so CI
// setups pointing at the live Comgate provider don't false-fail.

test.describe("Mock payment flow", () => {
  test("add to cart, fill checkout, pay on mock gate, land on paid order", async ({
    page,
  }) => {
    await page.goto("/products");

    const firstProduct = page.locator('a[href^="/products/"]').first();
    await expect(firstProduct).toBeVisible({ timeout: 10_000 });
    await firstProduct.click();

    const addToCart = page.getByRole("button", { name: /P.idat do ko..ku/i });
    await expect(addToCart).toBeVisible();
    await addToCart.click();
    await expect(
      page.getByRole("button", { name: /P.id.no do ko..ku|Ji. v ko..ku/i }),
    ).toBeVisible();

    await page.goto("/checkout");

    const mockBanner = page
      .getByText(/Testovac.{0,2} re.im/i)
      .first();
    if (!(await mockBanner.isVisible().catch(() => false))) {
      test.skip(
        true,
        "PAYMENT_PROVIDER != mock — test-mode banner missing on /checkout",
      );
    }

    // Step 1 — contact
    await page.getByLabel("Jméno").fill("Jana");
    await page.getByLabel("Příjmení").fill("Nováková");
    await page
      .getByLabel("Email")
      .fill(`e2e-mock-${Date.now()}@example.com`);
    await page
      .getByRole("button", { name: /^Pokračovat$/ })
      .first()
      .click();

    // Step 2 — switch to Česká pošta (avoids Packeta widget) + address
    await page.getByText("Česká pošta").click();
    await page.getByLabel("Telefon").fill("+420123456789");
    await page.getByLabel("Ulice a číslo popisné").fill("Testovací 1");
    await page.getByLabel("Město").fill("Praha");
    await page.getByLabel("PSČ").fill("11000");
    await page
      .getByRole("button", { name: /^Pokračovat$/ })
      .first()
      .click();

    // Step 3 — payment (card is default) → summary
    await page
      .getByRole("button", { name: /Pokračovat ke shrnutí/ })
      .click();

    // Step 4 — submit order
    await page.getByRole("button", { name: /Zaplatit kartou/ }).click();

    // Mock payment gate
    await page.waitForURL(/\/checkout\/mock-payment/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Mock platba/ })).toBeVisible();

    // Success card is pre-filled — click Zaplatit
    await page.getByRole("button", { name: /^Zaplatit$/ }).click();

    // End state: /order/JN-... with a token — the payment-return page redirects
    // to the order page once the mock confirm endpoint has flipped status to paid.
    await page.waitForURL(/\/order\/JN-[^?]+\?token=/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/order\/JN-[^?]+\?token=/);
  });
});
