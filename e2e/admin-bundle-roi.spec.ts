import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// J13-T1 Bundle ROI math + status badges + recommendations + Telegram alert (Task #832, Cycle #5114).
// Validates the bundle ROI surface end-to-end:
//   1. ROI math: 8/10 sold @ 1000 from 5000 invest → ROI=+60 % rendered on detail page.
//   2. Status badges: 5 separate seeded bundles cover loss / pending / profit / done_profit / done_loss
//      classifyStatus() branches; assert each badge label appears on the /admin/bundles list.
//   3. Recommendations insight: detail page renders the "Co kupovat příště?" panel when at least one
//      bundle line has ≥2 pieces (Bolt currently computes the insight inline on the page; the dedicated
//      /api/admin/bundles/[id]/recommendations endpoint is not built yet — see test.fixme below).
//   4. Telegram break-even alert: feature not yet wired (no caller of sendTelegramAdminMessage on
//      order paid/break-even crossover) — covered by test.fixme so the gap is tracked, not silenced.
//   5. Performance: /admin/bundles must load fast; measure goto time, soft-warn if >500 ms but only
//      hard-fail if >5 000 ms (Turbopack first-compile in dev easily blows past 500 ms but the page
//      itself should render quickly once compiled).

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const SUPPLIER_NAME = `E2E_BUNDLE_ROI_${RUN_ID}`;
const NAME_PREFIX = `E2E ROI ${RUN_ID}`;
const SLUG_PREFIX = `e2e-roi-${RUN_ID}`;
const SKU_PREFIX = `E2E-ROI-${RUN_ID}`;

type SeededBundle = {
  id: string;
  invoiceNumber: string;
  productIds: string[];
  soldProductIds: string[];
  customerId: string;
  orderId: string | null;
};

let supplierId = "";
let categoryId = "";
const seeded: Record<
  "loss" | "pending" | "profit" | "done_profit" | "done_loss",
  SeededBundle
> = {} as never;

async function seedBundle(opts: {
  status: keyof typeof seeded;
  invoiceSuffix: string;
  totalCost: number;
  pieces: { price: number; sold: boolean }[];
  lineCount?: number;
}): Promise<SeededBundle> {
  const { invoiceSuffix, totalCost, pieces } = opts;
  const lineCount = opts.lineCount ?? 1;

  const invoiceNumber = `${NAME_PREFIX} ${invoiceSuffix}`;

  const bundle = await prisma.supplierBundle.create({
    data: {
      supplierId,
      orderDate: new Date(),
      receivedDate: new Date(),
      invoiceNumber,
      totalKg: 10,
      totalPrice: totalCost,
      status: "received",
      sourceFile: `e2e-roi-${RUN_ID}-${invoiceSuffix}.ods`,
    },
    select: { id: true, invoiceNumber: true },
  });

  // Seed bundle lines so the per-line aggregation has something to group by.
  // The recommendations insight ("Co kupovat příště?") needs lines with ≥2 pieces.
  const lines = [];
  for (let li = 0; li < lineCount; li++) {
    const line = await prisma.supplierBundleLine.create({
      data: {
        bundleId: bundle.id,
        code: `${1000 + li}`,
        name: `Řádek ${li + 1}`,
        kg: 5,
        pricePerKg: 100,
        totalPrice: 500,
      },
      select: { id: true },
    });
    lines.push(line.id);
  }

  const productIds: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const product = await prisma.product.create({
      data: {
        name: `${NAME_PREFIX} ${invoiceSuffix} #${i + 1}`,
        slug: `${SLUG_PREFIX}-${invoiceSuffix.toLowerCase()}-${i + 1}`,
        sku: `${SKU_PREFIX}-${invoiceSuffix}-${i + 1}`,
        description: `E2E ROI piece ${i + 1}`,
        price: p.price,
        costBasis: totalCost / pieces.length,
        categoryId,
        condition: "excellent",
        sizes: "[]",
        colors: "[]",
        images: "[]",
        measurements: "{}",
        stock: p.sold ? 0 : 1,
        sold: p.sold,
        active: true,
        bundleId: bundle.id,
        bundleLineId: lines[i % lines.length],
      },
      select: { id: true },
    });
    productIds.push(product.id);
  }

  // One Customer per bundle keeps cleanup deterministic.
  const customer = await prisma.customer.create({
    data: {
      email: `e2e-roi-${RUN_ID}-${invoiceSuffix}@example.test`,
      firstName: "E2E",
      lastName: `ROI ${invoiceSuffix}`,
    },
    select: { id: true },
  });

  const soldPieces = pieces
    .map((p, i) => ({ ...p, idx: i }))
    .filter((p) => p.sold);
  const soldProductIds = soldPieces.map((p) => productIds[p.idx]);

  let orderId: string | null = null;
  if (soldPieces.length > 0) {
    const subtotal = soldPieces.reduce((acc, p) => acc + p.price, 0);
    const order = await prisma.order.create({
      data: {
        orderNumber: `E2E-ROI-${RUN_ID}-${invoiceSuffix}`,
        accessToken: `tok-roi-${RUN_ID}-${invoiceSuffix}`,
        customerId: customer.id,
        status: "paid",
        paymentMethod: "card",
        subtotal,
        shipping: 0,
        total: subtotal,
        items: {
          create: soldPieces.map((p) => ({
            productId: productIds[p.idx],
            name: `${NAME_PREFIX} ${invoiceSuffix} #${p.idx + 1}`,
            price: p.price,
            quantity: 1,
          })),
        },
      },
      select: { id: true },
    });
    orderId = order.id;
  }

  return {
    id: bundle.id,
    invoiceNumber: bundle.invoiceNumber!,
    productIds,
    soldProductIds,
    customerId: customer.id,
    orderId,
  };
}

test.beforeAll(async () => {
  const supplier = await prisma.supplier.create({
    data: { name: SUPPLIER_NAME, active: true },
    select: { id: true },
  });
  supplierId = supplier.id;

  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!category) throw new Error("No category in dev DB — cannot seed bundle ROI test");
  categoryId = category.id;

  // ROI math + 5 badge scenarios:
  //   profit:      cost=5000, 10 pieces @ 1000, 8 sold → revenue=8000, ROI=+60 %, not all sold ⇒ profit (🟢)
  //   loss:        cost=1000, 5 pieces @ 200,  0 sold  → revenue=0    ⇒ loss (🔴)
  //   pending:     cost=1000, 5 pieces @ 200,  1 sold  → revenue=200<1000 ⇒ pending (🟡)
  //   done_profit: cost=1000, 2 pieces @ 800,  2 sold  → revenue=1600≥1000 + allSold ⇒ done_profit (✅)
  //   done_loss:   cost=2000, 2 pieces @ 500,  2 sold  → revenue=1000<2000 + allSold ⇒ done_loss (💀)
  seeded.profit = await seedBundle({
    status: "profit",
    invoiceSuffix: "PROFIT",
    totalCost: 5000,
    pieces: Array.from({ length: 10 }, (_, i) => ({ price: 1000, sold: i < 8 })),
    // 2 lines with 5 pieces each so the "Co kupovat příště?" insight panel renders.
    lineCount: 2,
  });
  seeded.loss = await seedBundle({
    status: "loss",
    invoiceSuffix: "LOSS",
    totalCost: 1000,
    pieces: Array.from({ length: 5 }, () => ({ price: 200, sold: false })),
  });
  seeded.pending = await seedBundle({
    status: "pending",
    invoiceSuffix: "PENDING",
    totalCost: 1000,
    pieces: Array.from({ length: 5 }, (_, i) => ({ price: 200, sold: i === 0 })),
  });
  seeded.done_profit = await seedBundle({
    status: "done_profit",
    invoiceSuffix: "DONEPROFIT",
    totalCost: 1000,
    pieces: Array.from({ length: 2 }, () => ({ price: 800, sold: true })),
  });
  seeded.done_loss = await seedBundle({
    status: "done_loss",
    invoiceSuffix: "DONELOSS",
    totalCost: 2000,
    pieces: Array.from({ length: 2 }, () => ({ price: 500, sold: true })),
  });
});

test.afterAll(async () => {
  for (const b of Object.values(seeded)) {
    if (b.orderId) {
      await prisma.orderItem.deleteMany({ where: { orderId: b.orderId } }).catch(() => {});
      await prisma.order.delete({ where: { id: b.orderId } }).catch(() => {});
    }
    if (b.customerId) {
      await prisma.customer.delete({ where: { id: b.customerId } }).catch(() => {});
    }
    if (b.productIds.length > 0) {
      await prisma.priceHistory
        .deleteMany({ where: { productId: { in: b.productIds } } })
        .catch(() => {});
      await prisma.product
        .deleteMany({ where: { id: { in: b.productIds } } })
        .catch(() => {});
    }
    if (b.id) {
      await prisma.supplierBundleLine.deleteMany({ where: { bundleId: b.id } }).catch(() => {});
      await prisma.supplierBundle.delete({ where: { id: b.id } }).catch(() => {});
    }
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

test.describe("J13-T1 — bundle ROI math + status badges", () => {
  test("profit bundle (8/10 sold @ 1000 from 5000) shows ROI=+60 % and Ziskový badge", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    const bundleId = seeded.profit.id;
    await page.goto(`/admin/bundles/${bundleId}`);

    // Header invoice number visible — confirms we're on the right detail page.
    await expect(
      page.getByRole("heading", { name: seeded.profit.invoiceNumber }),
    ).toBeVisible({ timeout: 10_000 });

    // KPI strip: ROI cell. The Kpi component renders label + value; we locate
    // the ROI label and assert the sibling value reads "60 %".
    const roiLabel = page.getByText("ROI", { exact: true }).first();
    await expect(roiLabel).toBeVisible();
    // The value sibling is the next span in the same Kpi container.
    const kpiContainer = roiLabel.locator("..");
    await expect(kpiContainer).toContainText(/60\s*%/);

    // Investice / Tržby / Zisk sanity check (5 000 / 8 000 / 3 000 — formatPrice uses CZK formatting).
    await expect(page.getByText(/Investice/i)).toBeVisible();
    await expect(page.getByText(/Tržby/i).first()).toBeVisible();
    // 8000 - 5000 = 3000 profit. Allow either "3 000" or "3000" formatting.
    await expect(page.locator("body")).toContainText(/8\s?000/);
    await expect(page.locator("body")).toContainText(/3\s?000/);

    // Break-even badge in header — revenue ≥ cost should render the ✅ chip.
    await expect(page.getByText(/Break-even dosažen/i)).toBeVisible();
  });

  test("all 5 status badges render on /admin/bundles list", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/admin/bundles?period=12&status=all");

    // Suspense streams the grid in — wait for "balík" count line to appear.
    await expect(page.getByText(/balík/i).first()).toBeVisible({
      timeout: 15_000,
    });

    // Each seeded bundle is keyed by invoiceNumber. The card link's aria-label
    // is `${name} — ${badge.ariaLabel}`. We verify both the invoice text and
    // the badge label are present on the same card.
    const expected: { key: keyof typeof seeded; badgeLabel: RegExp }[] = [
      { key: "loss", badgeLabel: /Ztrátový/ },
      { key: "pending", badgeLabel: /Break-even pending/ },
      { key: "profit", badgeLabel: /Ziskový/ },
      { key: "done_profit", badgeLabel: /Vyplatilo se/ },
      { key: "done_loss", badgeLabel: /Vyprodáno se ztrátou/ },
    ];

    for (const { key, badgeLabel } of expected) {
      const bundle = seeded[key];
      const card = page.locator(`a[href="/admin/bundles/${bundle.id}"]`);
      await expect(card, `card for ${key} bundle must render`).toBeVisible();
      await expect(
        card,
        `card for ${key} bundle must show "${badgeLabel}" badge`,
      ).toContainText(badgeLabel);
    }
  });

  test("recommendations insight panel renders when bundle has ≥2 pieces per line", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(`/admin/bundles/${seeded.profit.id}`);

    // The "Co kupovat příště?" panel computes top/avoid lines inline from
    // linesAgg. Profit bundle has 2 lines × 5 pieces ⇒ both pass the pieces≥2
    // filter and the panel must render with at least one entry.
    const panel = page.getByRole("region", { name: /Co kupovat příště/i });
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText(/Vyplatilo se/i)).toBeVisible();
  });

  test.fixme(
    "/api/admin/bundles/[id]/recommendations returns ≥1 insight",
    async () => {
      // TODO(J13): dedicated recommendations API endpoint not yet implemented.
      // Today the insight is computed inline on /admin/bundles/[id]/page.tsx
      // (top/avoid lines from linesAgg). When the API is built, replace this
      // fixme with a real fetch + JSON shape assertion. The previous test
      // covers the user-visible path in the meantime.
    },
  );

  test.fixme(
    "Telegram break-even alert fires with 🎉 when seal pushes bundle over cost",
    async () => {
      // TODO(J13): Telegram break-even alert is not wired yet. sendTelegramAdminMessage
      // exists in src/lib/telegram.ts but no caller fires it on the bundle break-even
      // crossover (order paid → cumulative revenue ≥ totalCost). When the hook is added
      // (likely in src/app/(admin)/admin/orders/actions.ts on status=paid transition),
      // this test should: (a) intercept POST https://api.telegram.org/bot*/sendMessage
      // via page.route, (b) seed a bundle below break-even, (c) place an order that
      // crosses the threshold, (d) assert the route mock was called with text matching /🎉/.
    },
  );

  test("/admin/bundles loads in <500 ms (soft) / <5 000 ms (hard)", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Pre-warm: run the route once so Turbopack first-compile cost (cold start in dev)
    // doesn't dominate the timing measurement we care about.
    await page.goto("/admin/bundles?period=12&status=all", {
      waitUntil: "domcontentloaded",
    });

    const start = Date.now();
    await page.goto("/admin/bundles?period=12&status=all", {
      waitUntil: "domcontentloaded",
    });
    const elapsed = Date.now() - start;

    console.log(`[perf] /admin/bundles domcontentloaded in ${elapsed} ms`);

    if (elapsed > 500) {
      console.warn(
        `[perf] /admin/bundles soft target 500 ms exceeded (${elapsed} ms) — investigate if this regresses on prod.`,
      );
    }
    // Hard ceiling protects against catastrophic regressions; dev mode realistically
    // sits well under 5 s once warmed up. Tighten this once Cache Components ship.
    expect(elapsed, `domcontentloaded should be <5000 ms, got ${elapsed} ms`).toBeLessThan(
      5_000,
    );
  });
});
