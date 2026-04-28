import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

// J9-T1 — drafts review page selection + completeness gate + bulk publish.
// Spec: docs/drafts-review-page-spec.md (Cycle #5049, task_id=815, Cycle #5083).
//
// Verifies the desktop review surface that bectly uses to triage Janička's
// mobile-uploaded drafts:
//   1. Seed a sealed batch with 3 ProductDraft rows: 2 complete (name + price
//      + categoryId + brand + condition + sizes + images) and 1 incomplete
//      (missing name). scoreDraft() in review-client.tsx flags the third as
//      "chybí: název".
//   2. Admin opens /admin/drafts/<batchId>. The 2-pane layout renders one
//      left-panel row per visible draft, each with a CompleteBadge or
//      "kompletní" emerald badge.
//   3. Click "Jen kompletní" — selects only the 2 complete pending drafts.
//      Two role=checkbox cells flip aria-checked=true; the publish button
//      reads "Publikovat vybrané (2)" and is enabled.
//   4. Click publish. publishDraftsAction promotes the 2 complete drafts to
//      Product rows (validateDraftForPublish passes name/price/category/
//      condition/images). The third draft never enters the action's id list,
//      so it stays in pending status — proving the completeness gate held.
//
// Why direct DB seed instead of the QR pipeline: J9-T1 is about the review
// page UI gate, not the cross-device handoff. Direct Prisma writes let us
// hit exactly the "2 complete + 1 missing name" matrix the spec calls for
// without juggling 3× mobile form submissions and a partial sealed batch.
//
// Image mock — products/<sku>.png URL on R2 hostname so:
//   * next/image accepts it (R2 is in remotePatterns)
//   * moveDraftImageToProducts() treats the URL as already-products and
//     returns it unchanged (no R2 CopyObject call), keeping the test offline.
//
// Cleanup — afterAll sweeps any Product whose name starts with NAME_PREFIX
// (with priceHistory FK first), then deletes tracked batches (cascade
// removes drafts). Mirrors the W-10 pattern in playwright-global-teardown.ts.

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const NAME_PREFIX = `E2E J9T1 Review ${RUN_ID}`;
const trackedBatchIds: string[] = [];

const R2_HOST = "https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev";

test.afterAll(async () => {
  const orphans = await prisma.product.findMany({
    where: { name: { startsWith: NAME_PREFIX } },
    select: { id: true },
  });
  if (orphans.length > 0) {
    const ids = orphans.map((p) => p.id);
    await prisma.priceHistory
      .deleteMany({ where: { productId: { in: ids } } })
      .catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  }
  if (trackedBatchIds.length > 0) {
    await prisma.productDraftBatch
      .deleteMany({ where: { id: { in: trackedBatchIds } } })
      .catch(() => {});
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
  const adminUser = await prisma.user.findUnique({
    where: { email: email! },
    select: { id: true },
  });
  expect(adminUser, "admin user must exist in DB").toBeTruthy();
  return adminUser!.id;
}

async function seedBatch(
  adminId: string,
  categoryId: string,
): Promise<{ batchId: string; completeIds: string[]; incompleteId: string }> {
  // tokenHash is @unique — derive from random bytes so parallel test workers
  // never collide. The auth route never sees this batch (we navigate via
  // /admin/drafts/<id> directly), so the JWT never has to verify.
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const batch = await prisma.productDraftBatch.create({
    data: {
      adminId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "sealed",
      sealedAt: new Date(),
    },
    select: { id: true },
  });
  trackedBatchIds.push(batch.id);

  const imageJson = (idx: number) =>
    JSON.stringify([{ url: `${R2_HOST}/products/j9t1-${RUN_ID}-${idx}.png`, alt: "" }]);

  // Two complete drafts — every scoreDraft + validateDraftForPublish field set.
  const complete1 = await prisma.productDraft.create({
    data: {
      batchId: batch.id,
      name: `${NAME_PREFIX} Modrý svetr`,
      price: 349,
      categoryId,
      brand: "Zara",
      condition: "excellent",
      sizes: JSON.stringify(["M"]),
      images: imageJson(1),
      status: "pending",
    },
    select: { id: true },
  });
  const complete2 = await prisma.productDraft.create({
    data: {
      batchId: batch.id,
      name: `${NAME_PREFIX} Černé kalhoty`,
      price: 249,
      categoryId,
      brand: "H&M",
      condition: "good",
      sizes: JSON.stringify(["38"]),
      images: imageJson(2),
      status: "pending",
    },
    select: { id: true },
  });
  // Incomplete — missing name (price/category/condition still present so the
  // gate's "kompletní" badge specifically calls out název as the missing field).
  const incomplete = await prisma.productDraft.create({
    data: {
      batchId: batch.id,
      // name omitted → null
      price: 199,
      categoryId,
      brand: "Levi's",
      condition: "excellent",
      sizes: JSON.stringify(["S"]),
      images: imageJson(3),
      status: "pending",
    },
    select: { id: true },
  });

  return {
    batchId: batch.id,
    completeIds: [complete1.id, complete2.id],
    incompleteId: incomplete.id,
  };
}

test.describe("J9-T1 — review page select + completeness gate + bulk publish", () => {
  test("Jen kompletní selects 2/3 drafts → publish creates 2 Products → incomplete stays pending", async ({
    page,
  }) => {
    const category = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    test.skip(!category, "No category in dev DB");

    const adminId = await loginAsAdmin(page);
    const { batchId, completeIds, incompleteId } = await seedBatch(
      adminId,
      category!.id,
    );

    // 1. Open review page. RSC fetch under the NextAuth admin cookie returns
    //    all 3 drafts; left panel renders them in createdAt order.
    await page.goto(`/admin/drafts/${batchId}`);
    const checkboxes = page.locator('[role="checkbox"]');
    await expect(checkboxes).toHaveCount(3);

    // Completeness badges — 2 emerald "kompletní", 1 amber "chybí: název".
    await expect(page.getByText("kompletní", { exact: false })).toHaveCount(2);
    await expect(page.getByText(/chybí.*název/)).toHaveCount(1);

    // Initially nothing selected. aria-checked lives on the role=checkbox span
    // itself, so use a compound selector instead of nested .locator() (which
    // would search descendants and trivially return 0).
    await expect(
      page.locator('[role="checkbox"][aria-checked="true"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('[role="checkbox"][aria-checked="false"]'),
    ).toHaveCount(3);

    // 2. Click "Jen kompletní" — selectComplete() filters pendingDrafts by
    //    scoreDraft().complete and sets selected to those ids only.
    await page.getByRole("button", { name: /Jen kompletní/ }).click();

    // Two checkboxes flip to aria-checked=true. The matching server-side
    // ids are completeIds[0], completeIds[1] — incompleteId stays unchecked.
    await expect(page.locator('[role="checkbox"][aria-checked="true"]')).toHaveCount(2);
    await expect(page.locator('[role="checkbox"][aria-checked="false"]')).toHaveCount(1);

    // 3. Publish button reads "(2)" and is enabled — publishableSelected.length
    //    equals selectedPending.length (no incomplete in selection means
    //    hasIncompleteSelected=false, so the disabled gate clears).
    const publishBtn = page.getByRole("button", { name: /Publikovat vybrané \(2\)/ });
    await expect(publishBtn).toBeEnabled();

    await publishBtn.click();

    // 4. publishDraftsAction promotes both complete drafts to Product rows.
    //    Poll the DB instead of waiting on a specific request — server actions
    //    don't expose a stable URL pattern across Next versions.
    await expect
      .poll(
        async () => {
          const products = await prisma.product.findMany({
            where: { name: { startsWith: NAME_PREFIX } },
            select: { id: true },
          });
          return products.length;
        },
        { timeout: 15_000, intervals: [500, 1_000] },
      )
      .toBe(2);

    // 5. Two complete drafts flipped to status=published with publishedProductId
    //    populated; the incomplete draft remains pending and unlinked. This is
    //    the core J9-T1 invariant — the completeness gate held.
    const completeRows = await prisma.productDraft.findMany({
      where: { id: { in: completeIds } },
      select: { id: true, status: true, publishedProductId: true },
    });
    expect(completeRows).toHaveLength(2);
    expect(completeRows.every((d) => d.status === "published")).toBe(true);
    expect(completeRows.every((d) => d.publishedProductId !== null)).toBe(true);

    const incompleteRow = await prisma.productDraft.findUnique({
      where: { id: incompleteId },
      select: { status: true, publishedProductId: true, name: true },
    });
    expect(incompleteRow?.status).toBe("pending");
    expect(incompleteRow?.publishedProductId).toBeNull();
    expect(incompleteRow?.name).toBeNull();

    // 6. Created Products carry the Janička SKU prefix and stock=1 (second-hand
    //    unique-piece invariant). Same shape as admin-drafts-qr-pipeline.spec.
    const created = await prisma.product.findMany({
      where: { name: { startsWith: NAME_PREFIX } },
      select: { sku: true, active: true, sold: true, stock: true, slug: true },
    });
    expect(created).toHaveLength(2);
    for (const p of created) {
      expect(p.sku.startsWith("JN-")).toBe(true);
      expect(p.active).toBe(true);
      expect(p.sold).toBe(false);
      expect(p.stock).toBe(1);
      expect(p.slug.length).toBeGreaterThan(0);
    }
  });
});
