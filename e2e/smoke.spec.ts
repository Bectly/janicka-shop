import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Janička/i);
  });

  test('product listing loads', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('main')).toBeVisible();
  });

  test('cart page loads', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.locator('main')).toBeVisible();
  });

  test('admin login page loads', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('form')).toBeVisible();
  });
});
