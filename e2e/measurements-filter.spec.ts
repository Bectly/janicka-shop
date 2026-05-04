import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Measurements sidebar filter — pre-launch smoke (Task #1067).
//
// What we exercise:
//   1. Desktop sidebar accordion "Rozměry (cm)" is present on /products when
//      at least one active+unsold product carries measurements JSON with a
//      numeric chest/waist/length value (hasMeasurementData gate in
//      product-filters.tsx).
//   2. Entering a value in the chest min input + blurring (or pressing Enter)
//      updates the URL query string with `chest_min=<n>` (products-client.tsx
//      `setFiltersAndUrl` mapping). chest_max likewise.
//   3. After filter applies, no React hydration error is logged. We watch the
//      page console for /Hydration/ or /did not match/ patterns.
//
// We seed a known product with measurements so the gate flips on even when
// the dev DB has no real catalog with measurements. Cleanup mirrors the
// pattern from measurements.spec.ts (productId + priceHistory deleteMany).

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const SKU = `E2E-MF-${UNIQUE}`;
const SLUG = `e2e-mf-${UNIQUE}`;
const NAME = `E2E Test Product ${UNIQUE} MF`;
const MEASUREMENTS = JSON.stringify({
  chest: 92,
  waist: 74,
  hips: 96,
  length: 58,
});

let productId: string | null = null;

test.beforeAll(async () => {
  const cat = await prisma.category.findFirst({ select: { id: true } });
  if (!cat) return;
  const product = await prisma.product.create({
    data: {
      name: NAME,
      slug: SLUG,
      description:
        "E2E auto-generated (measurements-filter.spec.ts). Cleaned up in afterAll.",
      price: 599,
      sku: SKU,
      categoryId: cat.id,
      active: true,
      sold: false,
      measurements: MEASUREMENTS,
    },
    select: { id: true },
  });
  productId = product.id;
});

test.afterAll(async () => {
  if (productId) {
    await prisma.priceHistory
      .deleteMany({ where: { productId } })
      .catch(() => {});
    await prisma.product
      .delete({ where: { id: productId } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Measurements filter — desktop sidebar accordion", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("Rozměry accordion present, chest_min/max wire URL params, no hydration warnings", async ({
    page,
  }) => {
    test.skip(!productId, "Dev DB nemá kategorii — nelze seedovat E2E produkt");

    const hydrationErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error" && msg.type() !== "warning") return;
      const text = msg.text();
      if (/Hydration|did not match|Text content does not match/i.test(text)) {
        hydrationErrors.push(text);
      }
    });

    await page.goto("/products");

    // Desktop sidebar is `aside.hidden lg:block`. The accordion item label
    // text is "Rozměry (cm)" (renderMeasurementRow / measurementsSection).
    const trigger = page.getByRole("button", { name: /Rozměry \(cm\)/i });
    await expect(trigger).toBeVisible({ timeout: 10_000 });

    // Open the accordion if it's closed (Radix toggles aria-expanded).
    const expanded = await trigger.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await trigger.click();
    }

    // chest min input has id="measure-chest-min".
    const chestMin = page.locator("#measure-chest-min");
    await expect(chestMin).toBeVisible();
    await chestMin.fill("80");
    await chestMin.press("Enter");

    // Wait for nuqs to push the new query string.
    await expect
      .poll(() => new URL(page.url()).searchParams.get("chest_min"), {
        timeout: 5_000,
      })
      .toBe("80");

    const chestMax = page.locator("#measure-chest-max");
    await expect(chestMax).toBeVisible();
    await chestMax.fill("100");
    await chestMax.press("Enter");

    await expect
      .poll(() => new URL(page.url()).searchParams.get("chest_max"), {
        timeout: 5_000,
      })
      .toBe("100");

    // Active filter chip surfaces the bound: "Hruď 80–100 cm".
    await expect(page.getByText(/Hruď\s*80\s*–\s*100\s*cm/i)).toBeVisible();

    // No hydration mismatch should have fired during the interaction.
    expect(
      hydrationErrors,
      `Hydration warnings: ${hydrationErrors.join(" | ")}`,
    ).toHaveLength(0);
  });
});
