import { test, expect } from "@playwright/test";

// Admin smoke e2e (Task #987 / Cycle #5202).
// Sanity-check that the four critical admin landing screens render under a
// real admin session: /admin/dashboard, /admin/products, /admin/orders, and
// the bounce-out (/admin → /admin/login when anonymous).
//
// What this DOESN'T do (covered elsewhere):
//   - Role-gate enforcement → admin-auth-gate.spec.ts (customer JWT cannot
//     reach /admin/*, 9 admin server-action role checks).
//   - Quick-Add / product-create / product-edit happy paths →
//     admin-quick-add.spec.ts, admin-product-create.spec.ts,
//     admin-product-edit.spec.ts.
//
// Skips when E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not configured.
// Tagged @requires-db because the admin pages touch real DB queries.

async function loginAsAdmin(page: import("@playwright/test").Page) {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  test.skip(
    !adminEmail || !adminPassword,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured",
  );
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', adminEmail!);
  await page.fill('input[name="password"]', adminPassword!);
  await Promise.all([
    page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}

test.describe("Admin smoke — anonymous gating (no creds, runs everywhere)", () => {
  test("anonymous GET /admin → redirected to /admin/login", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("/admin/login renders the login form", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

test.describe("@requires-db Admin smoke — authenticated landing pages", () => {
  test("admin login → /admin/dashboard renders Přehled", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Přehled/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("/admin/products renders Produkty heading", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/products/);
    await expect(
      page.getByRole("heading", { name: /^Produkty$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("/admin/orders renders Objednávky heading", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/orders/);
    await expect(
      page.getByRole("heading", { name: /^Objednávky$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("admin can navigate dashboard → products → orders without re-login", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/products/);
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/orders/);
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });
});
