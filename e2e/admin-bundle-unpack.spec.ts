import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// J5-M7 Bundle Unpack pipeline e2e (Task #802, Cycle #5039, spec docs/suppliers-pipeline-spec.md §6 J5-M7).
// Covers the cost-basis flow: PC admin opens a bundle's /unpack page → selects a
// line (category code) + sets defaultWeightG → server action creates a
// ProductDraftBatch carrying { bundleId, bundleLineId, defaultWeightG }. The
// QR draft session then drops 2 items, seals, and the admin publishes. On
// publish, each Product must inherit bundleId/bundleLineId/weightG and snapshot
// `costBasis = weightG/1000 × bundleLine.pricePerKg`.
//
// Why we bypass the QR scan: the existing `/api/admin/drafts/auth?token=` path
// requires a server-signed JWT we can't forge from the test process (DRAFT_QR_SECRET
// is dev-server side), but `requireDraftSessionForBatch` only inspects the
// `draft_session` cookie whose value is `${batchId}:${adminId}`. Since the
// Playwright context already holds the admin's NextAuth cookie, we mint that
// session cookie directly via context.addCookies() — the auth route would set
// the same value if we round-tripped through the QR. This keeps the test focused
// on the cost-basis pipeline rather than the QR signing handshake (which
// admin-drafts-qr-pipeline.spec.ts already covers).

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const SUPPLIER_NAME = `E2E_SUPPLIER_${RUN_ID}`;
const NAME_PREFIX = `E2E Bundle Unpack ${RUN_ID}`;
const R2_HOST = "https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev";

// Numbers per task #802 spec: code=1714, pricePerKg=85, kg=8, defaultWeightG=200
// → costBasis = 200/1000 × 85 = 17.0 Kč.
const LINE_CODE = "1714";
const LINE_NAME = "Trička krátký rukáv A";
const PRICE_PER_KG = 85;
const TOTAL_KG = 8;
const TOTAL_PRICE = TOTAL_KG * PRICE_PER_KG; // 680
const DEFAULT_WEIGHT_G = 200;
const EXPECTED_COST_BASIS = (DEFAULT_WEIGHT_G / 1000) * PRICE_PER_KG; // 17

let supplierId = "";
let bundleId = "";
let lineId = "";
const trackedBatchIds: string[] = [];

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
      totalKg: TOTAL_KG,
      totalPrice: TOTAL_PRICE,
      status: "received",
      // sourceFile must be unique with supplierId — RUN_ID guarantees uniqueness
      // across reruns (and across teardown crash recovery).
      sourceFile: `e2e-bundle-unpack-${RUN_ID}.ods`,
    },
    select: { id: true },
  });
  bundleId = bundle.id;

  const line = await prisma.supplierBundleLine.create({
    data: {
      bundleId,
      code: LINE_CODE,
      name: LINE_NAME,
      kg: TOTAL_KG,
      pricePerKg: PRICE_PER_KG,
      totalPrice: TOTAL_PRICE,
    },
    select: { id: true },
  });
  lineId = line.id;
});

test.afterAll(async () => {
  // 1. Sweep any Product the publish step may have created, plus orphans
  //    matching our run's name prefix in case the test crashed mid-flight.
  const orphanProducts = await prisma.product.findMany({
    where: {
      OR: [
        { name: { startsWith: NAME_PREFIX } },
        { bundleId: bundleId || undefined },
      ],
    },
    select: { id: true },
  });
  if (orphanProducts.length > 0) {
    const ids = orphanProducts.map((p) => p.id);
    await prisma.priceHistory
      .deleteMany({ where: { productId: { in: ids } } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => {});
  }

  // 2. Sweep batches: tracked + any tied to our bundle (covers the case where
  //    the unpack action created a batch but trackedBatchIds.push didn't run).
  if (trackedBatchIds.length > 0) {
    await prisma.productDraftBatch
      .deleteMany({ where: { id: { in: trackedBatchIds } } })
      .catch(() => {});
  }
  if (bundleId) {
    await prisma.productDraftBatch
      .deleteMany({ where: { bundleId } })
      .catch(() => {});
  }

  // 3. Tear down the seeded supplier graph (line → bundle → supplier). Cascade
  //    on Supplier deletes pricelists; bundles are removed by the line's parent
  //    relation. Wrap in try/catch so a partial seed doesn't block disconnect.
  if (lineId) {
    await prisma.supplierBundleLine.delete({ where: { id: lineId } }).catch(() => {});
  }
  if (bundleId) {
    await prisma.supplierBundle.delete({ where: { id: bundleId } }).catch(() => {});
  }
  if (supplierId) {
    await prisma.supplier.delete({ where: { id: supplierId } }).catch(() => {});
  }

  await prisma.$disconnect();
});

async function loginAsAdmin(page: Page): Promise<string> {
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
  // Resolve the admin's user id directly — the draft_session cookie format is
  // "${batchId}:${adminId}" and we need the same id the unpack server action
  // writes to ProductDraftBatch.adminId so the auth check passes.
  const adminUser = await prisma.user.findUnique({
    where: { email: email! },
    select: { id: true },
  });
  expect(adminUser, "admin user must exist in DB").toBeTruthy();
  return adminUser!.id;
}

test.describe("J5-M7 — bundle unpack → costBasis", () => {
  test("admin unpacks bundle line, drops 2 mobile items, publishes → Products carry bundle link + costBasis", async ({
    page,
    context,
  }) => {
    const category = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    test.skip(!category, "No category in dev DB");

    const adminId = await loginAsAdmin(page);

    // 1+2. Open /admin/bundles/<id>/unpack and submit the form.
    //      The wireframe (spec §5.4) has a radio group keyed by line code, a
    //      defaultWeightG number input, and a single submit CTA. We match the
    //      line by code text "1714" and the weight input by its Czech label.
    await page.goto(`/admin/bundles/${bundleId}/unpack`);
    await expect(page.getByText(LINE_CODE).first()).toBeVisible({ timeout: 10_000 });

    // Radio: native <input type="radio"> exposes role=radio implicitly.
    // Sage's M5 may render either the code or "code – name"; match by code substring.
    const lineRadio = page
      .getByRole("radio", { name: new RegExp(LINE_CODE) })
      .first();
    await lineRadio.check();

    // Weight input: spec wireframe label "Hmotnost kousku (g)". Be lenient on
    // exact label so a small wording shift in the UI doesn't break the test.
    const weightInput = page.getByLabel(/[Hh]motnost/).first();
    await weightInput.fill(String(DEFAULT_WEIGHT_G));

    // Submit — server action creates ProductDraftBatch and (per spec §5.4) may
    // redirect either to /admin/products?openQR=<batchId> or to a confirmation
    // page. Either way we'll find the batch by (bundleId, adminId) below.
    await page
      .getByRole("button", {
        name: /Spustit QR batch|Rozbalit|Vytvořit batch|Pokračovat/i,
      })
      .click();

    // 3. Find the batch the server action created.
    await expect
      .poll(
        async () => {
          const b = await prisma.productDraftBatch.findFirst({
            where: { bundleId, adminId },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          return b ? "found" : "missing";
        },
        { timeout: 15_000, intervals: [500, 1_000] },
      )
      .toBe("found");

    const batchRow = await prisma.productDraftBatch.findFirst({
      where: { bundleId, adminId },
      orderBy: { createdAt: "desc" },
    });
    expect(batchRow).not.toBeNull();
    const batchId = batchRow!.id;
    trackedBatchIds.push(batchId);

    expect(batchRow!.bundleId).toBe(bundleId);
    expect(batchRow!.bundleLineId).toBe(lineId);
    expect(batchRow!.defaultWeightG).toBe(DEFAULT_WEIGHT_G);
    expect(batchRow!.status).toBe("open");

    // 4. Mock mobile session — inject draft_session cookie that the auth route
    //    would have set on a real QR scan. requireDraftSessionForBatch only
    //    splits "${batchId}:${adminId}" so we don't need the JWT round-trip.
    const baseUrl = new URL(page.url());
    await context.addCookies([
      {
        name: "draft_session",
        value: `${batchId}:${adminId}`,
        domain: baseUrl.hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Strict",
        // No secure flag in dev (NODE_ENV !== production); auth route mirrors this.
      },
    ]);

    // 5. POST 2 draft items via the same mobile API the QR mobile form uses.
    for (let i = 0; i < 2; i++) {
      const itemRes = await page.request.post(
        `/api/admin/drafts/${batchId}/items`,
        {
          data: {
            name: `${NAME_PREFIX} Tričko ${i + 1}`,
            price: 199 + i * 10,
            condition: "excellent",
            categoryId: category!.id,
            sizes: ["M"],
            images: [`${R2_HOST}/products/bundle-mock-${RUN_ID}-${i}.png`],
          },
        },
      );
      expect(
        itemRes.ok(),
        `items POST #${i} failed: ${itemRes.status()} ${await itemRes.text().catch(() => "")}`,
      ).toBe(true);
    }

    // 6. Seal — flips status open → sealed.
    const sealRes = await page.request.post(`/api/admin/drafts/${batchId}/seal`);
    expect(sealRes.ok(), `seal failed: ${sealRes.status()}`).toBe(true);

    // 7. Publish via admin API (NextAuth admin cookie still on the context).
    const publishRes = await page.request.post(
      `/api/admin/drafts/${batchId}/publish`,
      { data: { draftIds: "all" } },
    );
    expect(publishRes.ok(), `publish failed: ${publishRes.status()}`).toBe(true);
    const result = (await publishRes.json()) as {
      published: number;
      skipped: number;
      errors: { draftId: string; reason: string }[];
    };
    expect(
      result.skipped,
      `expected 0 skipped, got ${result.skipped}: ${JSON.stringify(result.errors)}`,
    ).toBe(0);
    expect(result.published).toBe(2);

    // 8. Assert Product rows carry bundle link + costBasis snapshot.
    //    costBasis must equal (weightG/1000) × line.pricePerKg = 17.0.
    await expect
      .poll(
        async () => {
          const count = await prisma.product.count({
            where: { name: { startsWith: NAME_PREFIX } },
          });
          return count;
        },
        { timeout: 10_000, intervals: [500, 1_000] },
      )
      .toBe(2);

    const products = await prisma.product.findMany({
      where: { name: { startsWith: NAME_PREFIX } },
      select: {
        id: true,
        bundleId: true,
        bundleLineId: true,
        weightG: true,
        costBasis: true,
      },
    });
    expect(products).toHaveLength(2);
    for (const p of products) {
      expect(p.bundleId, "Product.bundleId must propagate from batch").toBe(bundleId);
      expect(p.bundleLineId, "Product.bundleLineId must propagate from batch").toBe(
        lineId,
      );
      expect(p.weightG, "Product.weightG must equal batch.defaultWeightG").toBe(
        DEFAULT_WEIGHT_G,
      );
      expect(
        p.costBasis,
        `Product.costBasis must equal (weightG/1000)*pricePerKg = ${EXPECTED_COST_BASIS}`,
      ).toBeCloseTo(EXPECTED_COST_BASIS, 5);
    }
  });
});
