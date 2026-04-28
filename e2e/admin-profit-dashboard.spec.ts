import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// J7-T1 Profit dashboard end-to-end (Task #819, Cycle #5108).
// Depends on J7-B1 (GET /api/admin/reports/profit) + #801 (SAGE /admin/reports/profit page).
//
// Seeds Supplier + SupplierBundle (totalPrice=1000) with 2 Products (costBasis=200,
// price=450 each). Marks 1 sold via Order/OrderItem with status="paid". Logs in
// as admin, navigates to /admin/reports/profit (smoke), then queries the
// /api/admin/reports/profit JSON endpoint with bundleId filter so the assertion
// is hermetic against whatever else lives in the dev DB.
//
// Assertions on filtered API response:
//   summary: revenue=450, costBasis=200, grossProfit=250, marginPct≈55.5
//   byBundle: row exists with our bundleId, totalCost=1000, conversionRate=50,
//             pieceCount=2, soldCount=1
//   staleStock: the unsold product is NOT listed (createdAt = now < 90d cutoff)

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const SUPPLIER_NAME = `E2E_PROFIT_${RUN_ID}`;
const SLUG_PREFIX = `e2e-profit-${RUN_ID}`;
const SKU_PREFIX = `E2E-PROFIT-${RUN_ID}`;
const NAME_PREFIX = `E2E Profit ${RUN_ID}`;
const ORDER_NUMBER = `E2E-PROFIT-${RUN_ID}`;
const CUSTOMER_EMAIL = `e2e-profit-${RUN_ID}@example.test`;

let supplierId = "";
let bundleId = "";
let soldProductId = "";
let unsoldProductId = "";
let customerId = "";
let orderId = "";

test.beforeAll(async () => {
  const supplier = await prisma.supplier.create({
    data: { name: SUPPLIER_NAME, active: true },
    select: { id: true },
  });
  supplierId = supplier.id;

  const bundle = await prisma.supplierBundle.create({
    data: {
      supplierId,
      orderDate: new Date(),
      receivedDate: new Date(),
      totalKg: 10,
      totalPrice: 1000,
      status: "received",
      sourceFile: `e2e-profit-${RUN_ID}.ods`,
    },
    select: { id: true },
  });
  bundleId = bundle.id;

  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!category) throw new Error("No category in dev DB — cannot seed profit test");

  const sold = await prisma.product.create({
    data: {
      name: `${NAME_PREFIX} Sold`,
      slug: `${SLUG_PREFIX}-sold`,
      sku: `${SKU_PREFIX}-S`,
      description: "E2E profit (sold)",
      price: 450,
      costBasis: 200,
      categoryId: category.id,
      condition: "excellent",
      sizes: "[]",
      colors: "[]",
      images: "[]",
      measurements: "{}",
      stock: 0,
      sold: true,
      active: true,
      bundleId,
    },
    select: { id: true },
  });
  soldProductId = sold.id;

  const unsold = await prisma.product.create({
    data: {
      name: `${NAME_PREFIX} Unsold`,
      slug: `${SLUG_PREFIX}-unsold`,
      sku: `${SKU_PREFIX}-U`,
      description: "E2E profit (unsold)",
      price: 450,
      costBasis: 200,
      categoryId: category.id,
      condition: "excellent",
      sizes: "[]",
      colors: "[]",
      images: "[]",
      measurements: "{}",
      stock: 1,
      sold: false,
      active: true,
      bundleId,
    },
    select: { id: true },
  });
  unsoldProductId = unsold.id;

  const customer = await prisma.customer.create({
    data: {
      email: CUSTOMER_EMAIL,
      firstName: "E2E",
      lastName: "Profit",
    },
    select: { id: true },
  });
  customerId = customer.id;

  const order = await prisma.order.create({
    data: {
      orderNumber: ORDER_NUMBER,
      accessToken: `tok-profit-${RUN_ID}`,
      customerId: customer.id,
      status: "paid",
      paymentMethod: "card",
      subtotal: 450,
      shipping: 0,
      total: 450,
      items: {
        create: [
          {
            productId: soldProductId,
            name: `${NAME_PREFIX} Sold`,
            price: 450,
            quantity: 1,
          },
        ],
      },
    },
    select: { id: true },
  });
  orderId = order.id;
});

test.afterAll(async () => {
  if (orderId) {
    await prisma.orderItem.deleteMany({ where: { orderId } }).catch(() => {});
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
  }
  if (customerId) {
    await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
  }
  for (const id of [soldProductId, unsoldProductId].filter(Boolean)) {
    await prisma.priceHistory.deleteMany({ where: { productId: id } }).catch(() => {});
    await prisma.product.delete({ where: { id } }).catch(() => {});
  }
  if (bundleId) {
    await prisma.supplierBundle.delete({ where: { id: bundleId } }).catch(() => {});
  }
  if (supplierId) {
    await prisma.supplier.delete({ where: { id: supplierId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

async function loginAsAdmin(page: Page): Promise<void> {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(
    !email || !password,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured",
  );
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', email!);
  await page.fill('input[name="password"]', password!);
  await Promise.all([
    page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}

test.describe("J7-T1 — profit dashboard end-to-end", () => {
  test("seeded bundle shows revenue/cost/margin + conversionRate=50% + unsold piece NOT in stale list", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Smoke: page loads under admin auth (page.tsx redirects if !admin).
    await page.goto("/admin/reports/profit");
    await expect(
      page.getByRole("heading", { name: /Reporty.*Zisk/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Hit the API filtered to our bundle so the assertion is hermetic against
    // unrelated rows in the dev DB. Admin NextAuth cookie carries through
    // page.request from the browser context.
    const res = await page.request.get(
      `/api/admin/reports/profit?bundleId=${bundleId}`,
    );
    expect(res.ok(), `API ${res.status()}: ${await res.text().catch(() => "")}`).toBe(
      true,
    );
    const body = (await res.json()) as {
      summary: {
        revenue: number;
        costBasis: number;
        grossProfit: number;
        marginPct: number;
      };
      byBundle: {
        bundleId: string;
        totalCost: number;
        revenue: number;
        grossProfit: number;
        marginPct: number;
        conversionRate: number;
        pieceCount: number;
        soldCount: number;
      }[];
      staleStock: { productId: string }[];
    };

    // Summary: only 1 sold piece in scope (price=450, costBasis=200).
    expect(body.summary.revenue).toBe(450);
    expect(body.summary.costBasis).toBe(200);
    expect(body.summary.grossProfit).toBe(250);
    expect(body.summary.marginPct).toBeCloseTo(55.5, 1);

    // Bundle ROI row.
    const row = body.byBundle.find((b) => b.bundleId === bundleId);
    expect(row, "byBundle must contain seeded bundle").toBeTruthy();
    expect(row!.totalCost).toBe(1000);
    expect(row!.pieceCount).toBe(2);
    expect(row!.soldCount).toBe(1);
    expect(row!.conversionRate).toBe(50);
    expect(row!.revenue).toBe(450);
    expect(row!.grossProfit).toBe(450 - 1000); // -550 (under cost basis until rest sells)

    // Stale stock: unsold product was created moments ago — must NOT appear.
    expect(
      body.staleStock.find((s) => s.productId === unsoldProductId),
      "freshly-created unsold piece must not be flagged as stale (<90d)",
    ).toBeUndefined();
  });
});
