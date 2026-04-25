/**
 * Playwright globalTeardown — sweeps orphan E2E artefacts in the dev DB.
 *
 * E2E specs seed Product + WishlistSubscription / BackInStockSubscription /
 * EmailDedupLog rows in beforeAll and clean them up in afterAll. If the
 * runner is killed mid-test (Ctrl-C, OOM, CI timeout) afterAll never fires
 * and the dev DB ends up with stale rows that pollute later sessions and
 * can flake downstream specs. globalTeardown runs even on Ctrl-C, so this
 * is the systemic safety net.
 *
 * Sweeps (Phase 8 W-row bundle, C4922):
 *   - W-5  (closed C4914): orphan sold=true Products → revert to sold=false.
 *           "Completed" = paid | paid_mock | shipped | delivered | received.
 *   - W-9b (closed C4922): orphan WishlistSubscription / BackInStockSubscription
 *           / EmailDedupLog / AbandonedCart rows whose `email` matches
 *           `%-e2e-%@test.local`.
 *   - W-10 (closed C4922): orphan Product rows where `sku` startsWith `E2E-`
 *           AND `name` startsWith `E2E Test Product `. Double-key on both
 *           columns neutralises false-positive risk if a real seller ever
 *           uses an `E2E-` SKU prefix. PriceHistory rows for the same products
 *           are swept first to satisfy the FK.
 *   - W-9  (obviated C4922): back-in-stock-dispatch.spec.ts no longer mutates
 *           Product.createdAt — the spec creates its own product whose default
 *           createdAt sits inside the cron's 48h-fresh window, so the original
 *           "revert createdAt" gap is structurally avoided. No teardown logic
 *           required. Tracked here so future maintainers don't reintroduce a
 *           createdAt mutation without re-opening the gap.
 */
import { PrismaClient } from "@prisma/client";

const COMPLETED_ORDER_STATUSES = [
  "paid",
  "paid_mock",
  "shipped",
  "delivered",
  "received",
];

export default async function globalTeardown() {
  const prisma = new PrismaClient();
  try {
    // W-5: revert orphan sold=true products (no completed orderItem).
    const soldRevert = await prisma.product.updateMany({
      where: {
        sold: true,
        orderItems: {
          none: {
            order: { status: { in: COMPLETED_ORDER_STATUSES } },
          },
        },
      },
      data: { sold: false },
    });
    if (soldRevert.count > 0) {
      console.log(
        `[playwright-global-teardown] W-5: reverted ${soldRevert.count} orphan sold=true product(s)`,
      );
    }

    // W-9b: sweep orphan e2e subscription / dedup rows. Match the spec email
    // shape `<prefix>-e2e-<unique>@test.local` (wishlist-sold-e2e-…,
    // back-in-stock-e2e-…) via contains '-e2e-' + endsWith '@test.local' AND.
    const e2eEmailFilter = {
      AND: [
        { email: { contains: "-e2e-" } },
        { email: { endsWith: "@test.local" } },
      ],
    };

    const dedupSweep = await prisma.emailDedupLog.deleteMany({
      where: e2eEmailFilter,
    });
    if (dedupSweep.count > 0) {
      console.log(
        `[playwright-global-teardown] W-9b: deleted ${dedupSweep.count} orphan EmailDedupLog row(s)`,
      );
    }

    const wishSubSweep = await prisma.wishlistSubscription.deleteMany({
      where: e2eEmailFilter,
    });
    if (wishSubSweep.count > 0) {
      console.log(
        `[playwright-global-teardown] W-9b: deleted ${wishSubSweep.count} orphan WishlistSubscription row(s)`,
      );
    }

    const bisSubSweep = await prisma.backInStockSubscription.deleteMany({
      where: e2eEmailFilter,
    });
    if (bisSubSweep.count > 0) {
      console.log(
        `[playwright-global-teardown] W-9b: deleted ${bisSubSweep.count} orphan BackInStockSubscription row(s)`,
      );
    }

    const abandonedCartSweep = await prisma.abandonedCart.deleteMany({
      where: e2eEmailFilter,
    });
    if (abandonedCartSweep.count > 0) {
      console.log(
        `[playwright-global-teardown] W-9b: deleted ${abandonedCartSweep.count} orphan AbandonedCart row(s)`,
      );
    }

    // W-10: sweep orphan E2E products. Match BOTH sku prefix AND name prefix
    // (double-key) to avoid hitting any real seller listings. Two prefix
    // pairs are recognised: the original create-spec pair (`E2E-` / `E2E Test
    // Product `, C4922) and the edit-spec pair (`E2E-EDIT-` / `E2E Edit
    // Product `, C4927 #578) added when admin-product-edit.spec.ts landed.
    const e2eProductFilter = {
      OR: [
        {
          AND: [
            { sku: { startsWith: "E2E-" } },
            { name: { startsWith: "E2E Test Product " } },
          ],
        },
        {
          AND: [
            { sku: { startsWith: "E2E-EDIT-" } },
            { name: { startsWith: "E2E Edit Product " } },
          ],
        },
      ],
    };
    const orphanProducts = await prisma.product.findMany({
      where: e2eProductFilter,
      select: { id: true },
    });
    if (orphanProducts.length > 0) {
      const ids = orphanProducts.map((p) => p.id);
      await prisma.priceHistory
        .deleteMany({ where: { productId: { in: ids } } })
        .catch(() => {});
      const productSweep = await prisma.product.deleteMany({
        where: { id: { in: ids } },
      });
      if (productSweep.count > 0) {
        console.log(
          `[playwright-global-teardown] W-10: deleted ${productSweep.count} orphan E2E product(s)`,
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}
