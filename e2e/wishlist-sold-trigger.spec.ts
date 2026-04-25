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
// Skips gracefully when no eligible product exists OR CRON_SECRET is unset.

const prisma = new PrismaClient();
const TEST_EMAIL = `wishlist-sold-e2e-${Date.now()}@test.local`;
let productId: string | null = null;
let subscriptionId: string | null = null;

test.beforeAll(async () => {
  const target = await prisma.product.findFirst({
    where: { active: true, sold: false },
    select: { id: true },
  });
  if (!target) return;
  productId = target.id;
  const sub = await prisma.wishlistSubscription.create({
    data: { email: TEST_EMAIL, productId: target.id },
    select: { id: true },
  });
  subscriptionId = sub.id;
  await prisma.product.update({
    where: { id: target.id },
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
    await prisma.product
      .update({ where: { id: productId }, data: { sold: false } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Wishlist sold-item trigger — cron dispatch + dedup idempotency", () => {
  test("cron sets notifiedAt, writes exactly 1 EmailDedupLog row, idempotent on re-run", async ({
    request,
  }) => {
    test.skip(!productId || !subscriptionId, "No eligible product in dev DB");
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
      // globalTeardown covers SIGKILL/Ctrl-C, this catches the middle case
      // where a thrown assertion would still let afterAll run but a panic
      // before subscriptionId is recorded could leave the row orphaned.
      // Idempotent — if afterAll runs after this, the second delete/update
      // is a no-op via .catch(() => {}).
      if (productId) {
        await prisma.product
          .update({ where: { id: productId }, data: { sold: false } })
          .catch(() => {});
      }
    }
  });
});
