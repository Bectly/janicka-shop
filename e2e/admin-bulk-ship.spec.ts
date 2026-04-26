import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Admin bulk-mark-as-shipped e2e (Phase 9 bundle — closes C4927 trace_p1
// deferred-list gap, the admin bulk-ship #242 path that landed without e2e
// protection).
//
// What it covers:
//   /admin/orders renders an OrdersTable with per-row checkboxes + a fixed
//   action bar. With 2+ status="paid" rows selected, clicking "Označit jako
//   odeslané" → confirm() → calls the bulkMarkAsShipped server action which
//   fans out updateOrderStatus(id, "shipped") per id (transitions per
//   STATUS_TRANSITIONS in src/app/(admin)/admin/orders/actions.ts:25). Each
//   successful transition flips Order.status → "shipped" AND stamps
//   Order.shippedAt = new Date() (actions.ts:125).
//
// The shipping-notification email is dispatched fire-and-forget via
// dispatchEmail() (BullMQ enqueue + Resend inline fallback) — the spec does
// NOT assert email delivery (out-of-band, network-dependent) but does verify
// the synchronous DB writes that the cross-sell email pipeline reads from.
//
// Note on task wording vs. reality: the Lead task description called for an
// "EmailDedupLog row written" assertion. Inspecting src/lib/email-dedup.ts
// shows EmailDedupLog only covers back-in-stock | wishlist-sold |
// similar-item-arrived event types — there is NO dedup row for
// shipping-notification. The spec asserts what the code actually does:
// status transition + shippedAt timestamp.
//
// W-12 fix (cross-spec race under fullyParallel:true): orderNumber + sku +
// email all stamped with `${Date.now()}-${random}` suffix to avoid unique
// constraint collisions. Cleanup deletes Orders (cascades to OrderItems),
// then Product, then Customer. globalTeardown sweeps E2E-BULK-* and
// `*-e2e-*@test.local` shapes if the runner gets SIGKILL'd mid-test.

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TEST_EMAIL = `bulk-ship-e2e-${UNIQUE}@test.local`;
const SKU = `E2E-BULK-${UNIQUE}`;
const SLUG = `e2e-bulk-product-${UNIQUE}`;
const NAME = `E2E Bulk Product ${UNIQUE}`;
const ORDER_PREFIX = `E2E-BULK-${UNIQUE}`;

const SEED_COUNT = 3;

let seededCustomerId: string | null = null;
let seededProductId: string | null = null;
const seededOrderIds: string[] = [];
const seededOrderNumbers: string[] = [];

test.beforeAll(async () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;

  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!category) return;

  const product = await prisma.product.create({
    data: {
      name: NAME,
      slug: SLUG,
      description: "E2E auto-generated product (admin-bulk-ship.spec.ts).",
      price: 499,
      sku: SKU,
      categoryId: category.id,
      condition: "excellent",
      sizes: JSON.stringify(["Univerzální"]),
      colors: "[]",
      images: "[]",
      measurements: "{}",
      stock: 0,
      sold: true, // mirrors prod state — orderItem references a sold product
      active: true,
    },
    select: { id: true },
  });
  seededProductId = product.id;

  const customer = await prisma.customer.create({
    data: {
      email: TEST_EMAIL,
      firstName: "E2E",
      lastName: "BulkShip",
    },
    select: { id: true },
  });
  seededCustomerId = customer.id;

  for (let i = 0; i < SEED_COUNT; i++) {
    const orderNumber = `${ORDER_PREFIX}-${i}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        accessToken: `tok-${UNIQUE}-${i}`,
        customerId: customer.id,
        status: "paid", // SHIPPABLE_STATUS in orders-table.tsx
        paymentMethod: "card",
        shippingMethod: "packeta_home",
        shippingName: "E2E BulkShip",
        shippingStreet: "Testovací 1",
        shippingCity: "Praha",
        shippingZip: "11000",
        subtotal: 499,
        shipping: 0,
        total: 499,
        items: {
          create: [
            {
              productId: product.id,
              name: NAME,
              price: 499,
              quantity: 1,
              size: "Univerzální",
            },
          ],
        },
      },
      select: { id: true, orderNumber: true },
    });
    seededOrderIds.push(order.id);
    seededOrderNumbers.push(order.orderNumber);
  }
});

test.afterAll(async () => {
  // Order cascades to OrderItem; explicit deleteMany keeps cleanup atomic
  // even if some seeds failed mid-loop.
  if (seededOrderIds.length > 0) {
    await prisma.order
      .deleteMany({ where: { id: { in: seededOrderIds } } })
      .catch(() => {});
  }
  if (seededProductId) {
    await prisma.priceHistory
      .deleteMany({ where: { productId: seededProductId } })
      .catch(() => {});
    await prisma.product
      .delete({ where: { id: seededProductId } })
      .catch(() => {});
  }
  if (seededCustomerId) {
    await prisma.customer
      .delete({ where: { id: seededCustomerId } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Admin bulk-mark-as-shipped — multi-select round-trip", () => {
  test("checkbox-select N paid orders → bulk action flips status=shipped + stamps shippedAt", async ({
    page,
  }) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL;
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    test.skip(
      !adminEmail || !adminPassword,
      "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured",
    );
    test.skip(
      seededOrderIds.length !== SEED_COUNT,
      "Seed failed — needed 3 paid orders",
    );

    // 1. NextAuth credentials login → /admin/dashboard.
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', adminEmail!);
    await page.fill('input[name="password"]', adminPassword!);
    await Promise.all([
      page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 }),
      page.click('button[type="submit"]'),
    ]);

    // 2. Pre-handle the confirm() dialog before the click that triggers it
    //    (handleBulkShip → window.confirm, orders-table.tsx:82). Once-shot:
    //    a stale handler on later tests would auto-accept everything.
    page.once("dialog", (dialog) => {
      void dialog.accept();
    });

    // 3. Navigate to /admin/orders filtered by ?q=<UNIQUE> so the cached
    //    "use cache" page (cacheLife:minutes, src/app/(admin)/admin/orders/
    //    page.tsx:22-24) misses on this never-seen-before query string and
    //    we get a fresh DB read that includes the just-seeded orders.
    await page.goto(
      `/admin/orders?status=paid&q=${encodeURIComponent(ORDER_PREFIX)}`,
    );

    // 4. Wait until all SEED_COUNT order rows are visible, then check each
    //    via its aria-labeled checkbox ("Vybrat <orderNumber>" — see
    //    orders-table.tsx:305).
    for (const orderNumber of seededOrderNumbers) {
      await expect(
        page.getByRole("link", { name: orderNumber }),
      ).toBeVisible({ timeout: 10_000 });
    }
    for (const orderNumber of seededOrderNumbers) {
      await page
        .getByRole("checkbox", { name: `Vybrat ${orderNumber}` })
        .check();
    }

    // 5. Action bar surfaces "Označit jako odeslané (N)" — assert the count
    //    is exactly SEED_COUNT before clicking so we don't accidentally also
    //    flip some unrelated paid orders the cache happened to surface.
    const shipBtn = page.getByRole("button", {
      name: new RegExp(`Označit jako odeslané \\(${SEED_COUNT}\\)`),
    });
    await expect(shipBtn).toBeVisible();
    await shipBtn.click();

    // 6. Wait for the success toast — copy is `✓ Označeno jako odeslané: N`
    //    (orders-table.tsx:97). 20s budget covers N×Prisma updates +
    //    revalidate sweep + React transition.
    await expect(
      page.getByText(new RegExp(`Označeno jako odeslané: ${SEED_COUNT}`)),
    ).toBeVisible({ timeout: 20_000 });

    // 7. Authoritative DB round-trip: every seeded order MUST have flipped
    //    to status="shipped" with a non-null shippedAt.
    const after = await prisma.order.findMany({
      where: { id: { in: seededOrderIds } },
      select: { id: true, status: true, shippedAt: true },
    });
    expect(after).toHaveLength(SEED_COUNT);
    for (const row of after) {
      expect(row.status, `order ${row.id} status not shipped`).toBe("shipped");
      expect(
        row.shippedAt,
        `order ${row.id} shippedAt not stamped`,
      ).toBeTruthy();
    }
  });
});
