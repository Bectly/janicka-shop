/**
 * Playwright globalTeardown — reverts orphan sold=true products in the dev DB.
 *
 * E2E specs (sold-pdp.spec.ts and any future spec) flip Product.sold=true in
 * beforeAll and revert it in afterAll. If the runner is killed mid-test
 * (Ctrl-C, OOM, CI timeout) afterAll never fires and the dev DB ends up with
 * stale sold=true rows that pollute later sessions and can flake downstream
 * specs. globalTeardown runs even on Ctrl-C, so this is the systemic safety
 * net: any product currently flagged sold=true that has NO line items on a
 * completed order is treated as orphaned and reverted.
 *
 * "Completed" = paid | paid_mock | shipped | delivered | received.
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
    const result = await prisma.product.updateMany({
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
    if (result.count > 0) {
      console.log(
        `[playwright-global-teardown] reverted ${result.count} orphan sold=true product(s)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
