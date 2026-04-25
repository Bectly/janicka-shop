import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Admin product-edit happy path e2e (Gap E — complement to admin-product-create
// spec landed C4923 #566). Covers the OTHER half of the admin daily flow:
// price drops, name corrections, hide/unhide via the active toggle. Spec seeds
// a Product directly via Prisma, logs in as admin, opens the edit form, asserts
// pre-fill, mutates twice, then verifies DB + public PDP + /products listing
// observe each mutation.
//
// Note on task wording: the Lead task description called the toggle
// "available=false" and mentioned a "sold-overlay" engaging on the PDP. The
// admin edit form (src/components/admin/product-form.tsx) does NOT expose a
// `sold` checkbox — only `active` and `featured`. Sold state is set via
// checkout completion, not admin edits. The closest admin lever to "hide /
// make unavailable" is the `active` toggle, which is what this spec exercises.
// `active=false` removes the product from the public listing query
// (src/lib/products-cache.ts loadCatalog: `where: { active: true, sold:
// false }`) AND from PDP (loadProductBySlug: `where: { slug, active: true }`),
// so the PDP returns 404 instead of rendering a sold variant.
//
// Mutation A (price drop + rename, keep active=true): asserts the daily-flow
// edit round-trip — DB row reflects new price + new name, PDP renders new
// price + new name on the (renamed) slug, /products listing surfaces the
// updated name. Mutation B (active=false): asserts hide path — DB row reflects
// active=false, PDP 404s, listing no longer surfaces the slug.
//
// Cleanup: afterAll deletes the seeded Product + its PriceHistory rows
// (updateProduct logs old prices on each price change). Finally-block in the
// test catches the middle case where an assertion throws but afterAll still
// runs. globalTeardown (scripts/playwright-global-teardown.ts) covers
// SIGKILL/Ctrl-C — the W-10 sweep was extended in this PR to include the
// `E2E-EDIT-` SKU prefix + `E2E Edit Product ` name prefix double-key.

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const SKU = `E2E-EDIT-${UNIQUE}`;
const SLUG = `e2e-edit-product-${UNIQUE}`;
const NAME = `E2E Edit Product ${UNIQUE}`;
const NAME_UPDATED = `${NAME} UPDATED`;
let seededProductId: string | null = null;

test.beforeAll(async () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!category) return;

  // "Univerzální" is in DEFAULT_GROUPS + every CATEGORY_SIZE_GROUPS entry
  // (src/lib/sizes.ts), so the form's allowedSizesSet always accepts it
  // regardless of the seed category. This keeps the size submit valid even
  // though we are only mutating price/name/active.
  const product = await prisma.product.create({
    data: {
      name: NAME,
      slug: SLUG,
      description:
        "E2E auto-generated product (admin-product-edit.spec.ts). Cleaned up in afterAll.",
      price: 999,
      sku: SKU,
      categoryId: category.id,
      condition: "excellent",
      sizes: JSON.stringify(["Univerzální"]),
      colors: JSON.stringify(["Černá"]),
      images: "[]",
      measurements: "{}",
      stock: 1,
      active: true,
      sold: false,
      featured: false,
    },
    select: { id: true },
  });
  seededProductId = product.id;
});

test.afterAll(async () => {
  if (seededProductId) {
    await prisma.priceHistory
      .deleteMany({ where: { productId: seededProductId } })
      .catch(() => {});
    await prisma.product
      .delete({ where: { id: seededProductId } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Admin product-edit happy path — pre-fill → mutate → public reflect", () => {
  test("edit form pre-fills, mutates price+name then active, PDP + listing track each step", async ({
    page,
  }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    test.skip(
      !adminEmail || !adminPassword,
      "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured",
    );
    test.skip(!seededProductId, "Seed failed (no category in dev DB)");

    try {
      // 1. NextAuth credentials login → /admin/dashboard.
      await page.goto("/admin/login");
      await page.fill('input[name="email"]', adminEmail!);
      await page.fill('input[name="password"]', adminPassword!);
      await Promise.all([
        page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 }),
        page.click('button[type="submit"]'),
      ]);

      // 2. Open the edit form. Real path is /admin/products/<id>/edit
      //    (src/app/(admin)/admin/products/[id]/edit/page.tsx). Lead task
      //    wording said "[id]/page.tsx" — that file does not exist.
      await page.goto(`/admin/products/${seededProductId}/edit`);

      // 3. Pre-fill assertions — name, price, sku come from defaultValue on
      //    native inputs (product-form.tsx). Category + condition are Radix
      //    Selects driven by useState(product?.<field>); we only sanity-check
      //    name/price/sku since those are what the test mutates.
      await expect(page.locator('input[name="name"]')).toHaveValue(NAME);
      await expect(page.locator('input[name="price"]')).toHaveValue("999");
      await expect(page.locator('input[name="sku"]')).toHaveValue(SKU);

      // ── Mutation A: price drop 999 → 899, rename to ${NAME} UPDATED.
      //    Keep active=true so the public PDP + listing remain visible.
      await page.locator('input[name="name"]').fill(NAME_UPDATED);
      await page.locator('input[name="price"]').fill("899");

      // 4. Submit. updateProduct redirects to /admin/products on success.
      await Promise.all([
        page.waitForURL(/\/admin\/products(?:\/?|\?|$)/, { timeout: 20_000 }),
        page.click('button[type="submit"]:has-text("Uložit změny")'),
      ]);

      // 5. DB row reflects mutation A. Slug is regenerated from the new name
      //    (slugify in actions.ts), so we re-fetch by id to capture it.
      const afterA = await prisma.product.findUnique({
        where: { id: seededProductId! },
        select: { name: true, price: true, slug: true, active: true },
      });
      expect(afterA, "product row missing after mutation A").toBeTruthy();
      expect(afterA!.name).toBe(NAME_UPDATED);
      expect(afterA!.price).toBe(899);
      expect(afterA!.active).toBe(true);

      // 6. Public PDP renders new state on the (renamed) slug. The slug
      //    derives from the updated name via slugify, so it differs from
      //    SLUG; we use afterA.slug authoritatively.
      const pdpResponse = await page.goto(`/products/${afterA!.slug}`);
      expect(pdpResponse?.status()).toBeLessThan(400);
      await expect(page.getByText(NAME_UPDATED).first()).toBeVisible({
        timeout: 10_000,
      });
      // formatPrice renders "899 Kč" or "899 CZK" depending on locale config —
      // assert the integer appears on the page rather than tying to a single
      // formatter shape.
      await expect(page.getByText(/899/).first()).toBeVisible();

      // 7. /products?sort=newest listing surfaces the updated name on the
      //    new slug. revalidatePath sweeps cover both /products and /,
      //    plus invalidateProductCaches drops Redis. (W-11: pin sort=newest
      //    so the assertion does not silently break if the listing's default
      //    sort ever changes.)
      await page.goto("/products?sort=newest");
      const linkAfterA = page.locator(
        `a[href="/products/${afterA!.slug}"]`,
      );
      await expect(linkAfterA.first()).toBeVisible({ timeout: 10_000 });

      // ── Mutation B: flip active=false (the closest admin lever to "hide"
      //    / make unavailable — the form has no sold checkbox; sold flips on
      //    checkout completion, not admin edit).
      await page.goto(`/admin/products/${seededProductId}/edit`);
      // The active checkbox defaults to checked when product.active=true;
      // uncheck via Playwright's native helper.
      await page.locator('input[name="active"]').uncheck();

      await Promise.all([
        page.waitForURL(/\/admin\/products(?:\/?|\?|$)/, { timeout: 20_000 }),
        page.click('button[type="submit"]:has-text("Uložit změny")'),
      ]);

      // 8. DB row reflects mutation B.
      const afterB = await prisma.product.findUnique({
        where: { id: seededProductId! },
        select: { active: true, slug: true },
      });
      expect(afterB!.active).toBe(false);

      // 9. PDP no longer renders — loadProductBySlug requires active=true,
      //    so the route returns 404.
      const pdpAfterB = await page.goto(`/products/${afterB!.slug}`);
      expect(pdpAfterB?.status()).toBe(404);

      // 10. Listing no longer surfaces the slug — loadCatalog filters on
      //     active=true, sold=false.
      await page.goto("/products?sort=newest");
      const linkAfterB = page.locator(
        `a[href="/products/${afterB!.slug}"]`,
      );
      await expect(linkAfterB).toHaveCount(0);
    } finally {
      // Safety net — afterAll covers the happy path; this finally catches
      // the middle case where an assertion throws but afterAll still runs.
      // Idempotent — afterAll's pass is a no-op via .catch().
      if (seededProductId) {
        await prisma.priceHistory
          .deleteMany({ where: { productId: seededProductId } })
          .catch(() => {});
        await prisma.product
          .delete({ where: { id: seededProductId } })
          .catch(() => {});
        seededProductId = null;
      }
    }
  });
});
