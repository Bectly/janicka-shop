import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Similar-items arrived dispatch e2e (Gap C — docs/audits/e2e-coverage-gap-2026-04-25.md
// deferred-list line 340, "copy-paste class once A+B land"). Third member of the
// notify-cron trio: sibling to back-in-stock-dispatch.spec.ts (Gap B) and
// wishlist-sold-trigger.spec.ts (Gap A). Creates a dedicated Product (active+unsold,
// brand+sizes set, fresh createdAt within the cron's 48h window) plus a
// brand-tuple-matched ProductNotifyRequest, invokes /api/cron/similar-items with
// Bearer CRON_SECRET, and asserts:
//   (a) ProductNotifyRequest.notified is flipped to true,
//   (b) exactly 1 EmailDedupLog row with eventType="similar-item-arrived" exists for
//       the (email, productId) tuple — keyed on topProducts[0].id per route.ts:131,
//   (c) re-running the cron does NOT create a second EmailDedupLog row — the dedup
//       gate is the authoritative idempotency layer per Phase 7 KEY VERIFICATION
//       on #556 (the candidate-query notified=false filter short-circuits the
//       second run, but the dedup gate backstops any future regression).
// Skips gracefully when no Category exists OR CRON_SECRET is unset.
//
// SCHEMA DIVERGENCE (mirrors back-in-stock-dispatch.spec.ts:160-180 doc style):
// Unlike BackInStockSubscription.notifiedAt (DateTime?) +
// notifiedProductId (String?) and WishlistSubscription.notifiedAt (DateTime?),
// ProductNotifyRequest uses a single boolean `notified` flag (no timestamp, no
// product-id back-reference) — see prisma/schema.prisma. The cron updates only
// this flag (route.ts:155). Assertion (a) therefore checks `notified === true`
// rather than `notifiedAt !== null`. The dedup-row assertions (b)/(c) remain
// identical to siblings since EmailDedupLog is the shared cross-pipeline gate.
//
// W-12 fix (cross-spec race under fullyParallel:true): the spec creates its OWN
// dedicated Product with a unique brand string in beforeAll. The cron's brand
// preference filter (route.ts:114-123) collapses finalProducts to our row when
// the request specifies our unique brand, even if other products in the
// category are within the 48h window. SKU prefix `E2E-` matches the W-10
// globalTeardown sweep class.

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TEST_EMAIL = `similar-items-e2e-${UNIQUE}@test.local`;
const SKU = `E2E-SIM-${UNIQUE}`;
const SLUG = `e2e-sim-${UNIQUE}`;
const NAME = `E2E Test Product ${UNIQUE} SIM`;
const E2E_BRAND = `E2E-SIM-Brand-${UNIQUE}`;
const E2E_SIZE = "M";
let productId: string | null = null;
let requestId: string | null = null;

test.beforeAll(async () => {
  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) return;
  const product = await prisma.product.create({
    data: {
      name: NAME,
      slug: SLUG,
      description:
        "E2E auto-generated (similar-items-dispatch.spec.ts). Cleaned up in afterAll.",
      price: 100,
      sku: SKU,
      categoryId: category.id,
      brand: E2E_BRAND,
      sizes: JSON.stringify([E2E_SIZE]),
      active: true,
      sold: false,
      // createdAt defaults to now() — already inside the cron's 48h-fresh
      // candidate window (route.ts:73), so no post-create update needed.
    },
    select: { id: true },
  });
  productId = product.id;

  const req = await prisma.productNotifyRequest.create({
    data: {
      email: TEST_EMAIL,
      categoryId: category.id,
      sizes: JSON.stringify([E2E_SIZE]),
      brand: E2E_BRAND,
    },
    select: { id: true },
  });
  requestId = req.id;
});

test.afterAll(async () => {
  if (requestId) {
    await prisma.productNotifyRequest
      .delete({ where: { id: requestId } })
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

test.describe("Similar-items arrived dispatch — cron tuple-match + dedup idempotency", () => {
  test("cron flips notified=true, writes exactly 1 EmailDedupLog row, idempotent on re-run", async ({
    request,
  }) => {
    test.skip(!productId || !requestId, "No category in dev DB");
    const cronSecret = process.env.CRON_SECRET;
    test.skip(!cronSecret, "CRON_SECRET not configured");

    try {
      const res = await request.get("/api/cron/similar-items", {
        headers: { Authorization: `Bearer ${cronSecret!}` },
      });
      expect(res.ok()).toBeTruthy();

      const req = await prisma.productNotifyRequest.findUnique({
        where: { id: requestId! },
      });
      expect(req?.notified).toBe(true);

      const dedupRows = await prisma.emailDedupLog.findMany({
        where: {
          email: TEST_EMAIL,
          productId: productId!,
          eventType: "similar-item-arrived",
        },
      });
      expect(dedupRows.length).toBe(1);

      // Re-run cron → idempotent. Second invocation skips this request at the
      // candidate-query level (notified=false filter, route.ts:41), and the
      // dedup gate would still reject if that filter ever regressed.
      const res2 = await request.get("/api/cron/similar-items", {
        headers: { Authorization: `Bearer ${cronSecret!}` },
      });
      expect(res2.ok()).toBeTruthy();

      const dedupRowsAfter = await prisma.emailDedupLog.findMany({
        where: {
          email: TEST_EMAIL,
          productId: productId!,
          eventType: "similar-item-arrived",
        },
      });
      expect(dedupRowsAfter.length).toBe(1);
    } finally {
      // Safety net for assertion failures — afterAll covers the happy path,
      // globalTeardown covers SIGKILL/Ctrl-C. Idempotent — afterAll's second
      // pass is no-op.
      if (requestId) {
        await prisma.productNotifyRequest
          .delete({ where: { id: requestId } })
          .catch(() => {});
        requestId = null;
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
