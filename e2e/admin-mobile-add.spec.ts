import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// J8-T1 — mobile add happy path (Task #808, Cycle #5053, spec docs/qr-bulk-upload-spec.md §J8).
// Narrowest possible drive of the mobile add form: one photo, name, price,
// condition, size — then [Přidat další kousek] writes a ProductDraft and
// [HOTOVO] flips the batch to sealed.
//
// Why this exists alongside admin-drafts-qr-pipeline.spec.ts: the QR pipeline
// spec covers the full handshake (PC start → JWT auth route → mobile redirect
// → seal → review → bulk publish). This spec is the laser-focused J8 sanity
// check on the mobile form's *base fields* — minimal payload, single draft,
// no review/publish step. Decoupling lets J8 mobile-form regressions surface
// without dragging the slower full-pipeline test into every Trace pass.
//
// Cookie shortcut: we POST /api/admin/drafts/start (admin auth via NextAuth
// cookie) to mint the batch, then inject the `draft_session` cookie directly
// rather than round-tripping the signed JWT through /api/admin/drafts/auth.
// Same shortcut used in admin-bundle-unpack.spec.ts — requireDraftSessionForBatch
// only splits "${batchId}:${adminId}" so we don't need the QR signature ceremony.
//
// Category note: the spec wireframe lists "Kategorie" among base fields, but
// the live mobile form (mobile-add-form.tsx) intentionally omits it — category
// is assigned on the PC review page (`/admin/drafts/[batchId]`) before publish.
// The items API treats categoryId as optional, so we don't fill it here. If
// the mobile form ever gains a category select, this spec needs an extra step.
//
// Image upload: page.route('**/api/upload') → JSON with an R2-hostname URL.
// Same mock pattern as the QR pipeline spec — keeps the test off real R2 and
// matches next.config.ts remotePatterns so next/image renders without warnings.

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const NAME_PREFIX = `E2E Mobile Add ${RUN_ID}`;
const R2_HOST = "https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev";
const MOCK_IMAGE_URL = `${R2_HOST}/products/mobile-add-mock-${RUN_ID}.png`;

// 1×1 transparent PNG — enough bytes to satisfy the file input change handler.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const trackedBatchIds: string[] = [];

test.afterAll(async () => {
  // Defensive sweep — covers crashes mid-test that may have leaked Products
  // (the happy path doesn't publish, so this should normally be a no-op).
  const orphans = await prisma.product.findMany({
    where: { name: { startsWith: NAME_PREFIX } },
    select: { id: true },
  });
  if (orphans.length > 0) {
    const ids = orphans.map((p) => p.id);
    await prisma.priceHistory
      .deleteMany({ where: { productId: { in: ids } } })
      .catch(() => {});
    await prisma.product
      .deleteMany({ where: { id: { in: ids } } })
      .catch(() => {});
  }

  // Cascade delete every batch + its drafts.
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
  // Admin id is needed for the draft_session cookie value
  // ("${batchId}:${adminId}"). Same lookup as admin-bundle-unpack.spec.ts.
  const adminUser = await prisma.user.findUnique({
    where: { email: email! },
    select: { id: true },
  });
  expect(adminUser, "admin user must exist in DB").toBeTruthy();
  return adminUser!.id;
}

test.describe("J8-T1 — mobile add happy path (base fields)", () => {
  test("seed batch → inject cookie → mobile form fills 1 item → seal flips status", async ({
    page,
    context,
  }) => {
    const adminId = await loginAsAdmin(page);

    // 1. Seed batch via the same API the PC modal hits. page.request inherits
    //    the NextAuth admin cookie set during loginAsAdmin.
    const startRes = await page.request.post("/api/admin/drafts/start");
    expect(startRes.ok(), `start failed: ${startRes.status()}`).toBe(true);
    const { batchId } = (await startRes.json()) as { batchId: string };
    trackedBatchIds.push(batchId);

    // 2. Inject draft_session cookie — bypasses the QR JWT round-trip.
    //    requireDraftSessionForBatch parses "${batchId}:${adminId}" and the
    //    items/seal routes only check that the parsed batchId matches the URL
    //    param + the batch's adminId matches.
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

    // 3. Mock /api/upload — uploadFiles() POSTs multipart to /api/upload and
    //    expects { urls: [string] }. We return a single R2-hostname URL so
    //    next/image renders the thumbnail without warnings.
    await page.route("**/api/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ urls: [MOCK_IMAGE_URL] }),
      });
    });

    // 4. Open mobile form — cookie gate (MobileGate in page.tsx) checks the
    //    draft_session cookie and renders MobileAddForm if it matches the URL
    //    batchId. The "Vyfotit kousek" CTA proves we passed the gate.
    await page.goto(`/admin/drafts/${batchId}/mobile`);
    await expect(
      page.getByText("Vyfotit kousek", { exact: false }),
    ).toBeVisible({ timeout: 10_000 });

    // 5. Fill base fields. The file input is sr-only — setInputFiles bypasses
    //    the visible <label> and triggers handleFiles(), which calls our mocked
    //    /api/upload and pushes the URL into images[]. The "Hlavní" overlay on
    //    the first thumbnail confirms the upload landed.
    await page.setInputFiles('input[type="file"][accept="image/*"]', {
      name: "kus.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await expect(page.locator("text=Hlavní").first()).toBeVisible({
      timeout: 10_000,
    });

    const itemName = `${NAME_PREFIX} Tričko`;
    await page.fill("#m-name", itemName);
    await page.fill("#m-price", "390");
    // Stav=výborný: select value is "excellent" (CONDITION_LABELS["excellent"] = "Výborný").
    // Default is already "excellent" but we set it explicitly so the test
    // still passes if a future default changes.
    await page.selectOption("#m-condition", "excellent");
    // Velikost=M: chip-style toggle button (aria-pressed). exact:true avoids
    // matching size labels that contain "M" (e.g. "XS", "XL").
    await page.getByRole("button", { name: "M", exact: true }).click();

    // 6. Submit — "Přidat další kousek" POSTs to /api/admin/drafts/<id>/items
    //    and on success bumps the count badge + flashes "Kousek uložen" status.
    await page.getByRole("button", { name: /Přidat další kousek/ }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /Kousek uložen/ }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('header span[aria-label*="kousků v batchi"]'),
    ).toHaveText("1");

    // 7. Verify the ProductDraft row carries the values we typed. Fields like
    //    sizes/images are stored as JSON strings on the draft.
    const drafts = await prisma.productDraft.findMany({
      where: { batchId },
      select: {
        id: true,
        name: true,
        price: true,
        condition: true,
        sizes: true,
        images: true,
        status: true,
      },
    });
    expect(drafts).toHaveLength(1);
    const draft = drafts[0];
    expect(draft.name).toBe(itemName);
    expect(Number(draft.price)).toBe(390);
    expect(draft.condition).toBe("excellent");
    expect(JSON.parse(draft.sizes ?? "[]")).toEqual(["M"]);
    expect(JSON.parse(draft.images ?? "[]")).toEqual([MOCK_IMAGE_URL]);
    expect(["pending", "ready"]).toContain(draft.status);

    // 8. HOTOVO — POSTs /api/admin/drafts/<id>/seal which flips status to
    //    "sealed", sets sealedAt, and the form swaps to the success screen.
    await page.getByRole("button", { name: /HOTOVO/ }).click();
    await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible({
      timeout: 10_000,
    });

    // 9. Confirm the batch row is sealed at the DB layer (proves the seal
    //    request authenticated against the cookie + actually mutated state).
    const sealed = await prisma.productDraftBatch.findUnique({
      where: { id: batchId },
      select: { status: true, sealedAt: true },
    });
    expect(sealed?.status).toBe("sealed");
    expect(sealed?.sealedAt).toBeTruthy();
  });
});
