import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Sold PDP cross-sell — creates its own dedicated Product as sold=true in a
// category that already has ≥4 active+unsold products, navigates to the new
// slug, and asserts the "Podobné dostupné kousky" carousel renders ≥4 cards
// plus the inline "Hlídat podobný" CTA. Skips gracefully when no eligible
// category exists in the dev DB.
//
// W-12 fix (cross-spec race under fullyParallel:true): the spec creates its OWN
// dedicated Product instead of grabbing a shared active+unsold row and flipping
// it. This eliminates contention with wishlist-sold-trigger.spec.ts and
// back-in-stock-dispatch.spec.ts under workers=2. SKU prefix `E2E-` matches
// the W-10 globalTeardown sweep class. The carousel population requirement
// drops from ≥5 to ≥4 because we add our own 5th item which is the sold one,
// so the existing ≥4 fill the alternatives slot.

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const SKU = `E2E-SP-${UNIQUE}`;
const SLUG = `e2e-sp-${UNIQUE}`;
const NAME = `E2E Test Product ${UNIQUE} SP`;
let soldSlug: string | null = null;
let soldProductId: string | null = null;

test.beforeAll(async () => {
  // Find a category with ≥4 existing active+unsold products. We add a fresh
  // sold product to it; the carousel queries the OTHER products (id: { not:
  // ours }) and renders the ≥4 alternatives. This avoids any flip on a
  // shared product, so cross-spec parallelism is safe.
  const candidates = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { active: true, sold: false },
    _count: { _all: true },
    having: { categoryId: { _count: { gte: 4 } } },
    take: 1,
  });
  if (candidates.length === 0) return;
  const categoryId = candidates[0].categoryId;

  const product = await prisma.product.create({
    data: {
      name: NAME,
      slug: SLUG,
      description:
        "E2E auto-generated (sold-pdp.spec.ts). Cleaned up in afterAll.",
      price: 100,
      sku: SKU,
      categoryId,
      active: true,
      // Born sold — the spec only ever needs the sold-PDP variant rendered;
      // the create-and-flip dance from the previous shared-product version is
      // unnecessary here.
      sold: true,
    },
    select: { id: true, slug: true },
  });
  soldProductId = product.id;
  soldSlug = product.slug;
});

test.afterAll(async () => {
  if (soldProductId) {
    await prisma.priceHistory
      .deleteMany({ where: { productId: soldProductId } })
      .catch(() => {});
    await prisma.product
      .delete({ where: { id: soldProductId } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Sold PDP — similar carousel + back-in-stock CTA", () => {
  test("renders ≥4 similar cards and inline CTA targets back-in-stock form", async ({
    page,
  }) => {
    test.skip(!soldSlug, "No category with ≥4 active+unsold products in dev DB");

    try {
      await page.goto(`/products/${soldSlug}`);

      // "Prodáno" badge present — confirms sold-PDP variant rendered.
      await expect(page.getByText("Prodáno", { exact: true })).toBeVisible();

      // Similar carousel section.
      const carousel = page.getByTestId("sold-similar-carousel");
      await expect(carousel).toBeVisible({ timeout: 10_000 });

      // Carousel must surface ≥4 product cards (links into /products/<slug>).
      const cards = carousel.locator('a[href^="/products/"]');
      await expect(cards.first()).toBeVisible();
      expect(await cards.count()).toBeGreaterThanOrEqual(4);

      // Inline CTA "Dej mi vědět o podobném →" anchors to the back-in-stock form.
      const ctaLink = carousel.getByRole("link", {
        name: /Dej mi v.d.t o podobn.m/i,
      });
      await expect(ctaLink).toBeVisible();
      expect(await ctaLink.getAttribute("href")).toBe("#hlidat-podobny");

      // Back-in-stock form anchor exists with a working email input.
      const formAnchor = page.locator("#hlidat-podobny");
      await expect(formAnchor).toBeAttached();
      await expect(
        formAnchor.locator('input[type="email"][name="email"]'),
      ).toBeVisible();

      // Regression guard (Trace W-2 / Lead C4907 P1): on the sold PDP the
      // back-in-stock form must render exactly ONCE and the legacy NotifyMeForm
      // (used for ProductNotifyRequest dispatch on available PDPs) must be
      // ABSENT — otherwise a future revert that re-mounts NotifyMeForm into the
      // sold branch would silently double-dispatch emails on the same event.
      const backInStockForms = page.getByTestId("back-in-stock-form");
      await expect(backInStockForms).toHaveCount(1);
      await expect(page.getByTestId("notify-me-form")).toHaveCount(0);
    } finally {
      // Safety net for assertion failures — afterAll covers the happy path,
      // globalTeardown covers SIGKILL/Ctrl-C. With the W-12 fix the spec owns
      // its own Product row, so cleanup is delete instead of revert. The
      // existing globalTeardown sold=true→false sweep still works on this
      // row because it has no completed orderItems, but afterAll's product.
      // delete fires first under happy + middle paths.
      if (soldProductId) {
        await prisma.priceHistory
          .deleteMany({ where: { productId: soldProductId } })
          .catch(() => {});
        await prisma.product
          .delete({ where: { id: soldProductId } })
          .catch(() => {});
        soldProductId = null;
      }
    }
  });
});
