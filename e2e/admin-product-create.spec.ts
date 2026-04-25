import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Admin product-create happy path e2e (Gap C — docs/audits/e2e-coverage-gap-2026-04-25.md).
// Logs in as admin (NextAuth credentials), navigates to /admin/products/new,
// fills the ProductForm (Radix Select category + chip-button size + native
// inputs), submits, then asserts:
//   (a) Product row exists in DB by unique SKU with active=true sold=false,
//   (b) public PDP /products/<slug> renders 200 with product name visible,
//   (c) /products listing surfaces an anchor to the new product.
// Cleans up the created product + priceHistory rows in afterAll. Skips
// gracefully when E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD or any Category row
// is missing in the dev DB. Admin-auth setup raises spec size above the
// sold-pdp.spec.ts baseline — this is the heaviest of the C4912 e2e-bundle.
//
// Why this gap matters: admin product-create is the ONLY inventory ingestion
// path in production. Silent breakage = no new stock can be added (catastrophic
// blast radius even though the surface is touched rarely). Trace e2e-coverage
// audit composite ranking: P2 revenue + P1 integrity + P3 regression.

const prisma = new PrismaClient();
const UNIQUE = Date.now();
const SKU = `E2E-${UNIQUE}`;
const NAME = `E2E Test Product ${UNIQUE}`;
let createdProductId: string | null = null;

test.afterAll(async () => {
  if (createdProductId) {
    await prisma.priceHistory
      .deleteMany({ where: { productId: createdProductId } })
      .catch(() => {});
    await prisma.product
      .delete({ where: { id: createdProductId } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Admin product-create happy path — admin write → public PDP + listing", () => {
  test("form submit creates DB row, PDP renders, /products listing includes the new product", async ({
    page,
  }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    test.skip(
      !adminEmail || !adminPassword,
      "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured",
    );

    const category = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    });
    test.skip(!category, "No category in dev DB");

    try {
      // 1. NextAuth credentials login. The login form is JS-driven (signIn →
      //    router.push("/admin/dashboard")) so we wait for the dashboard URL
      //    rather than relying on an HTTP-level redirect.
      await page.goto("/admin/login");
      await page.fill('input[name="email"]', adminEmail!);
      await page.fill('input[name="password"]', adminPassword!);
      await Promise.all([
        page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 }),
        page.click('button[type="submit"]'),
      ]);

      // 2. Navigate to the create form.
      await page.goto("/admin/products/new");

      // 3. Fill native input/textarea fields. (categoryId + condition are
      //    Radix Selects; sizes is a chip grid — handled below.)
      await page.fill('input[name="name"]', NAME);
      await page.fill(
        'textarea[name="description"]',
        "E2E auto-generated product (admin-product-create.spec.ts). Cleaned up in afterAll.",
      );
      await page.fill('input[name="price"]', "499");
      await page.fill('input[name="sku"]', SKU);
      await page.fill('input[name="brand"]', "E2E Brand");
      await page.fill('input[name="colors"]', "Černá");

      // 4. Pick category via Radix Select. Trigger has id="categoryId";
      //    options render with role="option" and the Category.name as label.
      await page.click("#categoryId");
      await page
        .getByRole("option", { name: category!.name, exact: true })
        .first()
        .click();

      // 5. Pick a size. "Univerzální" is in every category's allowed groups
      //    (DEFAULT_GROUPS + every CATEGORY_SIZE_GROUPS entry in src/lib/sizes.ts)
      //    so it is always a safe pick across category fixtures.
      await page
        .getByRole("button", { name: "Univerzální", exact: true })
        .click();

      // 6. Submit. createProduct redirects to /admin/products on success;
      //    waitForURL races against the click promise. 20s budget covers
      //    Prisma write + revalidatePath sweeps + redirect.
      await Promise.all([
        page.waitForURL(/\/admin\/products(?:\/?|\?|$)/, { timeout: 20_000 }),
        page.click('button[type="submit"]:has-text("Vytvořit produkt")'),
      ]);

      // 7. Assert DB row exists. SKU is @unique on Product so this is an
      //    authoritative round-trip check that the server action persisted.
      const created = await prisma.product.findUnique({
        where: { sku: SKU },
        select: {
          id: true,
          slug: true,
          name: true,
          active: true,
          sold: true,
        },
      });
      expect(created, "product row not created in DB").toBeTruthy();
      createdProductId = created!.id;
      expect(created!.name).toBe(NAME);
      expect(created!.active).toBe(true);
      expect(created!.sold).toBe(false);

      // 8. Public PDP renders 200 with the product name visible.
      const pdpResponse = await page.goto(`/products/${created!.slug}`);
      expect(pdpResponse?.status()).toBeLessThan(400);
      await expect(page.getByText(NAME).first()).toBeVisible({
        timeout: 10_000,
      });

      // 9. /products listing surfaces a link to the new product. revalidatePath
      //    sweeps in createProduct cover both /products and /, so the new
      //    product should be paginated/ordered into the listing on first load.
      await page.goto("/products");
      const link = page.locator(`a[href="/products/${created!.slug}"]`);
      await expect(link.first()).toBeVisible({ timeout: 10_000 });
    } finally {
      // Safety net for assertion failures — afterAll covers happy path,
      // globalTeardown (scripts/playwright-global-teardown.ts) covers
      // SIGKILL/Ctrl-C, and this finally catches the middle case where a
      // thrown assertion still lets afterAll run but a panic mid-test could
      // leave the Product + PriceHistory rows behind. Idempotent — afterAll's
      // second pass is a no-op via .catch().
      if (createdProductId) {
        await prisma.priceHistory
          .deleteMany({ where: { productId: createdProductId } })
          .catch(() => {});
        await prisma.product
          .delete({ where: { id: createdProductId } })
          .catch(() => {});
      }
    }
  });
});
