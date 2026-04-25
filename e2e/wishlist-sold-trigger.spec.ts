import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Wishlist sold-item trigger e2e (Gap A — docs/audits/e2e-coverage-gap-2026-04-25.md).
// Subscribes a unique TEST_EMAIL to a product's WishlistSubscription, flips that
// product to sold=true via direct DB update (simulating the post-checkout finalize
// step in src/app/(shop)/checkout/actions.ts:543), invokes the wishlist-sold
// fallback cron with CRON_SECRET, and asserts:
//   (a) WishlistSubscription.notifiedAt is set,
//   (b) exactly 1 EmailDedupLog row with eventType="wishlist-sold" exists for the
//       (email, productId) tuple,
//   (c) re-running the cron does NOT create a second EmailDedupLog row — the dedup
//       gate is the authoritative idempotency layer per Phase 7 KEY VERIFICATION
//       on #556.
// Skips gracefully when no Category exists OR CRON_SECRET is unset.
//
// W-12 fix (cross-spec race under fullyParallel:true): the spec creates its OWN
// dedicated Product in beforeAll (unique SKU/slug) instead of grabbing a shared
// active+unsold row. This eliminates contention with sold-pdp.spec.ts and
// back-in-stock-dispatch.spec.ts, which previously could pick the SAME product
// under workers=2 and silently corrupt each other's tuple-match assertions.
// SKU prefix `E2E-` matches the W-10 globalTeardown sweep class.

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TEST_EMAIL = `wishlist-sold-e2e-${UNIQUE}@test.local`;
const SKU = `E2E-WS-${UNIQUE}`;
const SLUG = `e2e-ws-${UNIQUE}`;
const NAME = `E2E Test Product ${UNIQUE} WS`;
let productId: string | null = null;
let subscriptionId: string | null = null;

test.beforeAll(async () => {
  // W-9c: pick a category that has ≥1 OTHER active+unsold product, otherwise
  // sendWishlistSoldNotifications computes similarProducts.length === 0,
  // continues without writing a dedup row, and the spec's
  // `dedupRows.length === 1` assertion fails on a sparse dev DB. Mirrors the
  // sold-pdp.spec.ts groupBy({having:_count.gte:N}) precedent (sold-pdp uses
  // gte:4 for its ≥4-card carousel; wishlist-sold needs only 1 similar item
  // for the dedup row to be written).
  const candidates = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { active: true, sold: false },
    _count: { _all: true },
    having: { categoryId: { _count: { gte: 1 } } },
    take: 1,
  });
  if (candidates.length === 0) return;
  const categoryId = candidates[0].categoryId;
  const product = await prisma.product.create({
    data: {
      name: NAME,
      slug: SLUG,
      description:
        "E2E auto-generated (wishlist-sold-trigger.spec.ts). Cleaned up in afterAll.",
      price: 100,
      sku: SKU,
      categoryId,
      active: true,
      sold: false,
    },
    select: { id: true },
  });
  productId = product.id;
  const sub = await prisma.wishlistSubscription.create({
    data: { email: TEST_EMAIL, productId: product.id },
    select: { id: true },
  });
  subscriptionId = sub.id;
  await prisma.product.update({
    where: { id: product.id },
    data: { sold: true },
  });
});

test.afterAll(async () => {
  if (subscriptionId) {
    await prisma.wishlistSubscription
      .delete({ where: { id: subscriptionId } })
      .catch(() => {});
  }
  await prisma.emailDedupLog
    .deleteMany({ where: { email: TEST_EMAIL } })
    .catch(() => {});
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

test.describe("Wishlist sold-item trigger — cron dispatch + dedup idempotency", () => {
  test("cron sets notifiedAt, writes exactly 1 EmailDedupLog row, idempotent on re-run", async ({
    request,
  }) => {
    test.skip(
      !productId || !subscriptionId,
      "No category with ≥1 active+unsold product in dev DB",
    );
    const cronSecret = process.env.CRON_SECRET;
    test.skip(!cronSecret, "CRON_SECRET not configured");

    try {
      const res = await request.get("/api/cron/wishlist-sold-notify", {
        headers: { Authorization: `Bearer ${cronSecret!}` },
      });
      expect(res.ok()).toBeTruthy();

      const sub = await prisma.wishlistSubscription.findUnique({
        where: { id: subscriptionId! },
      });
      expect(sub?.notifiedAt).toBeTruthy();

      const dedupRows = await prisma.emailDedupLog.findMany({
        where: {
          email: TEST_EMAIL,
          productId: productId!,
          eventType: "wishlist-sold",
        },
      });
      expect(dedupRows.length).toBe(1);

      // Re-run cron → no second EmailDedupLog row (dedup gate authoritative).
      // Note: the cron filters notifiedAt IS NULL, so the second invocation
      // skips this subscription at the candidate-query level; the dedup gate
      // still backstops any future regression that loosens that filter.
      const res2 = await request.get("/api/cron/wishlist-sold-notify", {
        headers: { Authorization: `Bearer ${cronSecret!}` },
      });
      expect(res2.ok()).toBeTruthy();

      const dedupRowsAfter = await prisma.emailDedupLog.findMany({
        where: {
          email: TEST_EMAIL,
          productId: productId!,
          eventType: "wishlist-sold",
        },
      });
      expect(dedupRowsAfter.length).toBe(1);
    } finally {
      // Safety net for assertion failures — afterAll covers the happy path,
      // globalTeardown covers SIGKILL/Ctrl-C. With the W-12 fix the spec owns
      // its own Product row, so cleanup is symmetric: delete subscription +
      // dedup logs + product. Idempotent — afterAll's second pass is no-op.
      if (subscriptionId) {
        await prisma.wishlistSubscription
          .delete({ where: { id: subscriptionId } })
          .catch(() => {});
        subscriptionId = null;
      }
      if (productId) {
        await prisma.priceHistory
          .deleteMany({ where: { productId } })
          .catch(() => {});
        await prisma.product
          .delete({ where: { id: productId } })
          .catch(() => {});
        productId = null;
      }
    }
  });
});
