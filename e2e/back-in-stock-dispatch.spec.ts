import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Back-in-stock subscription dispatch e2e (Gap B — docs/audits/e2e-coverage-gap-2026-04-25.md).
// Sibling class to wishlist-sold-trigger.spec.ts. Picks an eligible Product
// (active, unsold, with brand + categoryId + at least one size in the JSON
// sizes array), creates a BackInStockSubscription whose tuple matches that
// product (categoryId + brand + first parsed size + condition=null), forces
// product.createdAt forward to now() so the cron's 48h-fresh window matches,
// invokes /api/cron/back-in-stock-notify with Bearer CRON_SECRET, and asserts:
//   (a) BackInStockSubscription.notifiedAt + notifiedProductId are set,
//   (b) exactly 1 EmailDedupLog row with eventType="back-in-stock" exists for
//       the (email, productId) tuple,
//   (c) re-running the cron does NOT create a second EmailDedupLog row — the
//       dedup gate is the authoritative idempotency layer per Phase 7 KEY
//       VERIFICATION on #556 (the candidate-query notifiedAt IS NULL filter
//       short-circuits the second run, but the dedup gate backstops any future
//       regression that loosens that filter).
// Skips gracefully when no eligible product exists OR CRON_SECRET is unset.

const prisma = new PrismaClient();
const TEST_EMAIL = `back-in-stock-e2e-${Date.now()}@test.local`;
let productId: string | null = null;
let subscriptionId: string | null = null;
let originalCreatedAt: Date | null = null;

test.beforeAll(async () => {
  const candidates = await prisma.product.findMany({
    where: {
      active: true,
      sold: false,
      brand: { not: null },
    },
    select: {
      id: true,
      brand: true,
      sizes: true,
      categoryId: true,
      createdAt: true,
    },
    take: 25,
  });

  let target: (typeof candidates)[number] | null = null;
  let firstSize: string | null = null;
  for (const c of candidates) {
    try {
      const arr = JSON.parse(c.sizes);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
        target = c;
        firstSize = arr[0];
        break;
      }
    } catch {
      // ignore — try next candidate
    }
  }

  if (!target) return;
  productId = target.id;
  originalCreatedAt = target.createdAt;

  const sub = await prisma.backInStockSubscription.create({
    data: {
      email: TEST_EMAIL,
      categoryId: target.categoryId,
      brand: target.brand,
      size: firstSize,
      condition: null,
    },
    select: { id: true },
  });
  subscriptionId = sub.id;

  // Push createdAt forward so the cron's 48h-fresh candidate window matches.
  await prisma.product.update({
    where: { id: target.id },
    data: { createdAt: new Date() },
  });
});

test.afterAll(async () => {
  if (subscriptionId) {
    await prisma.backInStockSubscription
      .delete({ where: { id: subscriptionId } })
      .catch(() => {});
  }
  await prisma.emailDedupLog
    .deleteMany({ where: { email: TEST_EMAIL } })
    .catch(() => {});
  if (productId && originalCreatedAt) {
    await prisma.product
      .update({
        where: { id: productId },
        data: { createdAt: originalCreatedAt },
      })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Back-in-stock subscription dispatch — cron tuple-match + dedup idempotency", () => {
  test("cron sets notifiedAt + notifiedProductId, writes exactly 1 EmailDedupLog row, idempotent on re-run", async ({
    request,
  }) => {
    test.skip(!productId || !subscriptionId, "No eligible product in dev DB");
    const cronSecret = process.env.CRON_SECRET;
    test.skip(!cronSecret, "CRON_SECRET not configured");

    try {
      const res = await request.get("/api/cron/back-in-stock-notify", {
        headers: { Authorization: `Bearer ${cronSecret!}` },
      });
      expect(res.ok()).toBeTruthy();

      const sub = await prisma.backInStockSubscription.findUnique({
        where: { id: subscriptionId! },
      });
      expect(sub?.notifiedAt).toBeTruthy();
      expect(sub?.notifiedProductId).toBeTruthy();

      const dedupRows = await prisma.emailDedupLog.findMany({
        where: {
          email: TEST_EMAIL,
          eventType: "back-in-stock",
        },
      });
      expect(dedupRows.length).toBe(1);

      // Re-run cron → idempotent. Second invocation skips this subscription
      // at the candidate-query level (notifiedAt IS NULL filter), and the
      // dedup gate would still reject if that filter ever regressed.
      const res2 = await request.get("/api/cron/back-in-stock-notify", {
        headers: { Authorization: `Bearer ${cronSecret!}` },
      });
      expect(res2.ok()).toBeTruthy();

      const dedupRowsAfter = await prisma.emailDedupLog.findMany({
        where: {
          email: TEST_EMAIL,
          eventType: "back-in-stock",
        },
      });
      expect(dedupRowsAfter.length).toBe(1);
    } finally {
      // Safety net for assertion failures — afterAll covers the happy path,
      // globalTeardown covers SIGKILL/Ctrl-C, this catches the middle case
      // where a thrown assertion would still let afterAll run but a panic
      // mid-test could leave the product createdAt mutated. Idempotent — if
      // afterAll runs after this, the second update is a no-op via .catch().
      if (productId && originalCreatedAt) {
        await prisma.product
          .update({
            where: { id: productId },
            data: { createdAt: originalCreatedAt },
          })
          .catch(() => {});
      }
    }
  });
});
