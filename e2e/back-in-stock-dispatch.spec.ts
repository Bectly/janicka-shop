import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Back-in-stock subscription dispatch e2e (Gap B — docs/audits/e2e-coverage-gap-2026-04-25.md).
// Sibling class to wishlist-sold-trigger.spec.ts. Creates a dedicated Product
// (active+unsold, brand+sizes set, fresh createdAt within the cron's 48h
// window) plus a tuple-matched BackInStockSubscription, invokes
// /api/cron/back-in-stock-notify with Bearer CRON_SECRET, and asserts:
//   (a) BackInStockSubscription.notifiedAt + notifiedProductId are set,
//   (b) exactly 1 EmailDedupLog row with eventType="back-in-stock" exists for
//       the (email, productId) tuple,
//   (c) re-running the cron does NOT create a second EmailDedupLog row — the
//       dedup gate is the authoritative idempotency layer per Phase 7 KEY
//       VERIFICATION on #556 (the candidate-query notifiedAt IS NULL filter
//       short-circuits the second run, but the dedup gate backstops any future
//       regression that loosens that filter).
// Skips gracefully when no Category exists OR CRON_SECRET is unset.
//
// W-12 fix (cross-spec race under fullyParallel:true): the spec creates its OWN
// dedicated Product with a unique brand string in beforeAll instead of grabbing
// a shared active+unsold row. This eliminates contention with
// wishlist-sold-trigger.spec.ts and sold-pdp.spec.ts, which previously could
// pick the SAME product under workers=2 (wishlist-sold flips sold=true → BIS
// cron's sold=false filter skipped the row → assertion failed intermittently).
// The unique e2e brand also guarantees the BIS cron's tuple-match resolves to
// our test product even if the dev DB has other products in the same category.
// SKU prefix `E2E-` matches the W-10 globalTeardown sweep class.

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TEST_EMAIL = `back-in-stock-e2e-${UNIQUE}@test.local`;
const SKU = `E2E-BIS-${UNIQUE}`;
const SLUG = `e2e-bis-${UNIQUE}`;
const NAME = `E2E Test Product ${UNIQUE} BIS`;
const E2E_BRAND = `E2E-BIS-Brand-${UNIQUE}`;
const E2E_SIZE = "M";
let productId: string | null = null;
let subscriptionId: string | null = null;

test.beforeAll(async () => {
  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) return;
  const product = await prisma.product.create({
    data: {
      name: NAME,
      slug: SLUG,
      description:
        "E2E auto-generated (back-in-stock-dispatch.spec.ts). Cleaned up in afterAll.",
      price: 100,
      sku: SKU,
      categoryId: category.id,
      brand: E2E_BRAND,
      sizes: JSON.stringify([E2E_SIZE]),
      active: true,
      sold: false,
      // createdAt defaults to now() — already inside the cron's 48h-fresh
      // candidate window, so no post-create update needed (W-9 cleanup
      // class avoided by construction).
    },
    select: { id: true },
  });
  productId = product.id;

  const sub = await prisma.backInStockSubscription.create({
    data: {
      email: TEST_EMAIL,
      categoryId: category.id,
      brand: E2E_BRAND,
      size: E2E_SIZE,
      condition: null,
    },
    select: { id: true },
  });
  subscriptionId = sub.id;
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

test.describe("Back-in-stock subscription dispatch — cron tuple-match + dedup idempotency", () => {
  test("cron sets notifiedAt + notifiedProductId, writes exactly 1 EmailDedupLog row, idempotent on re-run", async ({
    request,
  }) => {
    test.skip(!productId || !subscriptionId, "No category in dev DB");
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
      // globalTeardown covers SIGKILL/Ctrl-C. With the W-12 fix the spec owns
      // its own Product row, so cleanup is symmetric: delete subscription +
      // dedup logs + product. Idempotent — afterAll's second pass is no-op.
      if (subscriptionId) {
        await prisma.backInStockSubscription
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
