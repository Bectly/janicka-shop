import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Admin Quick-Add e2e (Task #777, Cycle #5018, J3 pipeline audit).
// Quick-Add is the mobile-first inventory ingestion path used to "rychle
// nahodit kus z mobilu" (CLAUDE.md business model). Until this spec there
// was zero automated coverage for the form — silent breakage means Janička
// can't add stock from her phone, which is the dominant ingestion mode.
//
// Three flows are exercised:
//   (1) Happy path: fill required fields (name, price, category, size) +
//       mocked photo upload → server action persists, redirect to
//       /admin/products?added=1, DB row exists with the auto-generated
//       JN-<base36> SKU, and the new product surfaces on /products?sort=newest.
//   (2) Validation: missing sizes → server action rejects via
//       sizesSchema.min(1) → form shows alert with
//       "Vyberte alespoň jednu velikost". No DB row created.
//   (3) Validation: price=0 → server action rejects via
//       z.coerce.number().positive() → form shows alert with
//       "Cena musí být kladná". No DB row created.
//
// Mocked photo upload — ImageUpload's R2 path requires a live signed-URL
// flow that's out of scope for this spec. Instead we set the hidden
// `images` input value directly via the native HTMLInputElement setter
// before submit. FormData reads input.value at submit time, so the server
// action receives a realistic JSON payload of {url, alt}[] entries even
// though no real upload happened. The server-side parseImages() validates
// shape via imagesSchema, so a malformed mock would fail loudly.
//
// Cleanup — Quick-Add auto-generates SKU as JN-<timestamp_base36>, so we
// can't double-key on an E2E- SKU prefix the way admin-product-create.spec
// does. Instead we use a unique name pattern `E2E Quick Add Product <ts>-<n>`
// and the afterAll hook deletes every product with `JN-` SKU prefix AND
// matching name prefix — same double-key safety as W-10 in
// scripts/playwright-global-teardown.ts, just with the auto-generated SKU.
// globalTeardown also extended with this pair as a SIGKILL safety net.

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const NAME_PREFIX = `E2E Quick Add Product ${RUN_ID}`;
const HAPPY_NAME = `${NAME_PREFIX}-happy`;

const MOCK_IMAGES = JSON.stringify([
  { url: "https://example.test/quickadd-mock.jpg", alt: "" },
]);

test.afterAll(async () => {
  // Sweep every product this spec might have created, even ones from a
  // crashed assertion. Double-key on SKU prefix + name prefix matches the
  // existing W-10 cleanup pattern.
  const orphans = await prisma.product.findMany({
    where: {
      AND: [
        { sku: { startsWith: "JN-" } },
        { name: { startsWith: NAME_PREFIX } },
      ],
    },
    select: { id: true },
  });
  if (orphans.length > 0) {
    const ids = orphans.map((p) => p.id);
    await prisma.priceHistory
      .deleteMany({ where: { productId: { in: ids } } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

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

async function setHiddenImages(
  page: import("@playwright/test").Page,
  json: string,
) {
  // React controls `<input type="hidden" name="images" value={...} />` so
  // input.value gets re-set on every render. We bypass the controlled-input
  // dance by writing through the native setter; React doesn't re-render
  // before submit because no state changes, and FormData reads the DOM
  // value at submit time.
  await page.evaluate((value) => {
    const input = document.querySelector(
      'input[name="images"]',
    ) as HTMLInputElement | null;
    if (!input) throw new Error("hidden images input not found");
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, json);
}

test.describe("Admin Quick-Add — happy path + validation errors", () => {
  test("happy path: required fields + mocked photo upload → product in DB + list", async ({
    page,
  }) => {
    const category = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    });
    test.skip(!category, "No category in dev DB");

    await loginAsAdmin(page);
    await page.goto("/admin/products/quick-add");

    // Fill required visible fields.
    await page.fill('input[name="name"]', HAPPY_NAME);
    await page.fill('input[name="price"]', "499");

    // Native <select> for category — selectOption by id and value works
    // because Quick-Add intentionally uses a native select for mobile UX.
    await page.selectOption('select[name="categoryId"]', category!.id);

    // Sizes don't render until categoryId is set. "Univerzální" is in
    // every category's allowed groups (CATEGORY_SIZE_GROUPS + DEFAULT_GROUPS
    // both include `one_size`) so it's the safest cross-category pick.
    await page
      .getByRole("button", { name: "Univerzální", exact: true })
      .click();

    // Mocked photo upload — populate hidden input that ImageUpload normally
    // writes after a successful R2 round-trip.
    await setHiddenImages(page, MOCK_IMAGES);

    // Submit. quickCreateProduct redirects to /admin/products?added=1 on
    // success; race the click against a URL wait with a generous budget
    // covering Prisma write + revalidatePath sweeps + redirect.
    await Promise.all([
      page.waitForURL(/\/admin\/products(?:\?added=1)?(?:\/|$|&)/, {
        timeout: 20_000,
      }),
      page.getByRole("button", { name: /Přidat kousek/ }).click(),
    ]);

    // Assert DB row exists. Match by unique name (we never reuse it).
    const created = await prisma.product.findFirst({
      where: { name: HAPPY_NAME },
      select: {
        id: true,
        slug: true,
        sku: true,
        price: true,
        active: true,
        sold: true,
        stock: true,
        images: true,
        categoryId: true,
      },
    });
    expect(created, "product row not created in DB").toBeTruthy();
    expect(created!.sku.startsWith("JN-")).toBe(true);
    expect(created!.price).toBe(499);
    expect(created!.active).toBe(true);
    expect(created!.sold).toBe(false);
    expect(created!.stock).toBe(1);
    expect(created!.categoryId).toBe(category!.id);

    // Mocked image payload made it through parseImages → JSON-stringified
    // {url, alt}[] in the DB.
    const storedImages = JSON.parse(created!.images);
    expect(Array.isArray(storedImages)).toBe(true);
    expect(storedImages[0]?.url).toBe(
      "https://example.test/quickadd-mock.jpg",
    );

    // /products listing surfaces a link to the new product. revalidatePath
    // sweeps in quickCreateProduct cover /products and / so the new piece
    // should be paginated/ordered into the listing on first load. Pin
    // ?sort=newest so a future default-sort change can't silently regress
    // the assertion.
    await page.goto("/products?sort=newest");
    const link = page.locator(`a[href="/products/${created!.slug}"]`);
    await expect(link.first()).toBeVisible({ timeout: 10_000 });
  });

  test("validation: missing sizes → 'Vyberte alespoň jednu velikost' error", async ({
    page,
  }) => {
    const category = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    test.skip(!category, "No category in dev DB");

    const NAME = `${NAME_PREFIX}-no-size`;

    await loginAsAdmin(page);
    await page.goto("/admin/products/quick-add");

    await page.fill('input[name="name"]', NAME);
    await page.fill('input[name="price"]', "499");
    await page.selectOption('select[name="categoryId"]', category!.id);
    // Intentionally do NOT click any size chip — sizes hidden input stays "".

    await page.getByRole("button", { name: /Přidat kousek/ }).click();

    // Server action rejects via sizesSchema.min(1). useActionState catches
    // the thrown ZodError and renders its message in the role="alert" div.
    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await expect(alert).toContainText("Vyberte alespoň jednu velikost");

    // No redirect happened — we're still on the form.
    expect(page.url()).toContain("/admin/products/quick-add");

    // No DB row created.
    const dbRow = await prisma.product.findFirst({
      where: { name: NAME },
      select: { id: true },
    });
    expect(dbRow).toBeNull();
  });

  test("validation: price 0 → 'Cena musí být kladná' error", async ({
    page,
  }) => {
    const category = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    test.skip(!category, "No category in dev DB");

    const NAME = `${NAME_PREFIX}-zero-price`;

    await loginAsAdmin(page);
    await page.goto("/admin/products/quick-add");

    await page.fill('input[name="name"]', NAME);
    // type=number + min=0 means HTML5 won't block 0; server zod
    // .positive() will. That's exactly the contract we want covered.
    await page.fill('input[name="price"]', "0");
    await page.selectOption('select[name="categoryId"]', category!.id);
    await page
      .getByRole("button", { name: "Univerzální", exact: true })
      .click();

    await page.getByRole("button", { name: /Přidat kousek/ }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await expect(alert).toContainText("Cena musí být kladná");

    expect(page.url()).toContain("/admin/products/quick-add");

    const dbRow = await prisma.product.findFirst({
      where: { name: NAME },
      select: { id: true },
    });
    expect(dbRow).toBeNull();
  });
});
