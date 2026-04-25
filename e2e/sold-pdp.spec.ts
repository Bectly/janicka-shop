import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Sold PDP cross-sell — flips a category product to sold for the duration of
// the test (assuming the category has ≥5 active items so the carousel can fill
// up), navigates to the sold slug, and asserts the "Podobné dostupné kousky"
// carousel renders at least 4 cards plus the inline "Hlídat podobný" CTA.
// Skips gracefully when no eligible category exists in the dev DB.

const prisma = new PrismaClient();

let soldSlug: string | null = null;
let soldProductId: string | null = null;

test.beforeAll(async () => {
  // Find a category with ≥5 active+available products so the sold-similar
  // carousel can score and return ≥4 alternatives.
  const candidates = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { active: true, sold: false },
    _count: { _all: true },
    having: { categoryId: { _count: { gte: 5 } } },
    take: 1,
  });
  if (candidates.length === 0) return;
  const categoryId = candidates[0].categoryId;
  const target = await prisma.product.findFirst({
    where: { categoryId, active: true, sold: false },
    select: { id: true, slug: true },
  });
  if (!target) return;
  soldSlug = target.slug;
  soldProductId = target.id;
  await prisma.product.update({
    where: { id: target.id },
    data: { sold: true },
  });
});

test.afterAll(async () => {
  if (soldProductId) {
    await prisma.product.update({
      where: { id: soldProductId },
      data: { sold: false },
    });
  }
  await prisma.$disconnect();
});

test.describe("Sold PDP — similar carousel + back-in-stock CTA", () => {
  test("renders ≥4 similar cards and inline CTA targets back-in-stock form", async ({
    page,
  }) => {
    test.skip(!soldSlug, "No category with ≥5 products in dev DB");

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
  });
});
