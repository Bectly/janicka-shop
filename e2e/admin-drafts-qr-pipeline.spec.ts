import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// J4 QR bulk-upload pipeline e2e (Task #792, Cycle #5029, spec docs/qr-bulk-upload-spec.md §9).
// Covers the cross-device handoff that lets Janička list stock from her phone:
//   PC admin opens QR modal → POST /api/admin/drafts/start signs HS256 JWT and
//   stores sha256(token) → phone visits /api/admin/drafts/auth?token=<jwt>
//   which 303-redirects to /admin/drafts/<id>/mobile and sets a 12h httpOnly
//   draft_session cookie (SameSite=Strict). Mobile form POSTs each item to
//   /api/admin/drafts/<id>/items, then /seal flips batch status to "sealed".
//   PC admin reviews on /admin/drafts/<id> and bulk-publishes via the
//   publishDraftsAction server action, which validates required fields,
//   slugifies + auto-generates JN-<base36> SKU, copies R2 drafts/→products/
//   (no-op for non-R2 URLs), creates Product + PriceHistory, and marks the
//   draft published.
//
// Three flows exercised:
//   (1) Happy path — admin login → start batch via API → follow signed JWT
//       URL (sets draft_session cookie) → mobile form fills 2 items with
//       mocked /api/upload responses → HOTOVO seals batch → /admin/drafts/<id>
//       review page renders 2 cards → bulk publish → 2 Product rows in DB.
//   (2) Guard — expired/invalid token returns 401 (verifyDraftQrToken throws
//       on signature mismatch; auth route maps that to a 401 HTML response).
//       Same status for missing-token. No draft_session cookie set.
//   (3) Guard — publish without name returns errors[].reason="Chybí název"
//       and creates zero Product rows. Validation lives in publishDraftsAction
//       (validateDraftForPublish) AND the API route, so we test the API path
//       since that's what the publish-all action ultimately mirrors.
//
// Image upload mocking — the mobile form uses uploadFiles() → POST /api/upload
// which streams multipart to Cloudflare R2. We page.route() that endpoint and
// return JSON {urls: [r2.dev/...]}. URLs match the R2 remotePatterns hostname
// so next/image renders without warnings; moveDraftImageToProducts checks
// `srcKey.startsWith("drafts/")` and our mock URLs use a non-drafts path so
// the move is a no-op (returns srcUrl unchanged) — keeping the test isolated
// from real R2 CopyObject/DeleteObject calls.
//
// Cleanup — afterAll sweeps every Product whose name starts with NAME_PREFIX
// (with priceHistory FK first), then every ProductDraftBatch we tracked
// (cascade deletes ProductDraft rows). Same double-key safety as W-10 in
// scripts/playwright-global-teardown.ts; we keep cleanup local because batch
// IDs are spec-internal and the global sweep doesn't know about them.

const prisma = new PrismaClient();
const RUN_ID = Date.now();
const NAME_PREFIX = `E2E QR Draft ${RUN_ID}`;
const trackedBatchIds: string[] = [];

const R2_HOST = "https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev";

// 1×1 transparent PNG — enough bytes to satisfy the file input.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.afterAll(async () => {
  // Sweep any Product the spec might have created (covers crashes mid-test).
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

  // Cascade delete every batch + its drafts.
  if (trackedBatchIds.length > 0) {
    await prisma.productDraftBatch
      .deleteMany({ where: { id: { in: trackedBatchIds } } })
      .catch(() => {});
  }

  await prisma.$disconnect();
});

async function loginAsAdmin(page: Page): Promise<void> {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  test.skip(
    !adminEmail || !adminPassword,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured",
  );
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', adminEmail!);
  await page.fill('input[name="password"]', adminPassword!);
  await Promise.all([
    page.waitForURL(/\/admin\/dashboard/, { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function startBatch(
  request: APIRequestContext,
): Promise<{ batchId: string; qrUrl: string }> {
  const res = await request.post("/api/admin/drafts/start");
  expect(res.ok(), `start failed: ${res.status()}`).toBe(true);
  const data = (await res.json()) as { batchId: string; qrUrl: string };
  trackedBatchIds.push(data.batchId);
  return data;
}

function extractToken(qrUrl: string): string {
  const u = new URL(qrUrl);
  const token = u.searchParams.get("token");
  expect(token, "qrUrl must carry signed token").toBeTruthy();
  return token!;
}

async function mockUploadRoute(page: Page, urlPool: string[]): Promise<void> {
  // Each route call consumes the next URL from the pool — keeps responses
  // deterministic across multiple uploads in the happy-path flow.
  let cursor = 0;
  await page.route("**/api/upload", async (route) => {
    const url = urlPool[cursor++ % urlPool.length];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ urls: [url] }),
    });
  });
}

async function fillMobileItem(
  page: Page,
  item: { name: string; price: string; size: string },
): Promise<void> {
  // Photo first — file input is sr-only; setInputFiles bypasses the visible
  // <label> and feeds the change handler directly. The mocked /api/upload
  // returns a URL which the form pushes into images[] and renders as a thumbnail.
  await page.setInputFiles('input[type="file"][accept="image/*"]', {
    name: "kus.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  // Wait for the upload mock to land and the thumbnail to render. The "Hlavní"
  // overlay marks the first image (idx === 0).
  await expect(page.locator('text=Hlavní').first()).toBeVisible({ timeout: 10_000 });

  await page.fill("#m-name", item.name);
  await page.fill("#m-price", item.price);
  await page.getByRole("button", { name: item.size, exact: true }).click();

  // Submit — clicking "Přidat další kousek" POSTs to /api/admin/drafts/<id>/items.
  // Success path resets the form (count badge bumps, savedFlash status appears).
  await page.getByRole("button", { name: /Přidat další kousek/ }).click();
  await expect(page.getByRole("status").filter({ hasText: /Kousek uložen/ })).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("J4 QR bulk-upload pipeline — happy path + guard rails", () => {
  // The happy path requires the mobile-page draft_session cookie to coexist
  // with the admin NextAuth cookie in the same browser context. Both cookies
  // are namespaced (different names) so they don't collide.
  test("happy path: admin → QR auth → mobile form 2 items → seal → bulk publish → 2 Products in DB", async ({
    page,
  }) => {
    const category = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    });
    test.skip(!category, "No category in dev DB");

    await loginAsAdmin(page);

    // 1. PC admin starts batch — uses the page's request context which
    //    inherits the NextAuth admin session cookie.
    const { batchId, qrUrl } = await startBatch(page.request);
    const token = extractToken(qrUrl);

    // 2. Phone "scans" QR — visit auth URL via page.goto. Server verifies JWT,
    //    sets httpOnly draft_session cookie (SameSite=Strict, 12h), 303
    //    redirects to /admin/drafts/<id>/mobile.
    //    We use a relative URL so we don't depend on getSiteUrl() matching
    //    Playwright's baseURL (production-like configs may differ).
    await page.goto(`/api/admin/drafts/auth?token=${encodeURIComponent(token)}`);
    await page.waitForURL(new RegExp(`/admin/drafts/${batchId}/mobile`), {
      timeout: 10_000,
    });

    // 3. Mock /api/upload — return R2-hostname URLs so next/image renders cleanly
    //    and moveDraftImageToProducts treats them as no-ops on publish (URL
    //    isn't under drafts/ prefix).
    await mockUploadRoute(page, [
      `${R2_HOST}/products/qr-mock-1.png`,
      `${R2_HOST}/products/qr-mock-2.png`,
    ]);

    // 4. First item — count badge starts at 0.
    await expect(page.locator('header span[aria-label*="kousků v batchi"]')).toHaveText(
      "0",
    );
    await fillMobileItem(page, {
      name: `${NAME_PREFIX} Šaty`,
      price: "499",
      size: "M",
    });
    await expect(page.locator('header span[aria-label*="kousků v batchi"]')).toHaveText(
      "1",
    );

    // 5. Second item.
    await fillMobileItem(page, {
      name: `${NAME_PREFIX} Sukně`,
      price: "299",
      size: "S",
    });
    await expect(page.locator('header span[aria-label*="kousků v batchi"]')).toHaveText(
      "2",
    );

    // 6. HOTOVO — seals batch, sets sealedAt, swaps to success screen.
    await page.getByRole("button", { name: /HOTOVO/ }).click();
    await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible({
      timeout: 10_000,
    });

    // Confirm DB-level seal so we know the cookie auth survived a state-mutating call.
    const sealedBatch = await prisma.productDraftBatch.findUnique({
      where: { id: batchId },
      select: { status: true, sealedAt: true },
    });
    expect(sealedBatch?.status).toBe("sealed");
    expect(sealedBatch?.sealedAt).toBeTruthy();

    // 7. PC admin opens review page. Drafts arrive without categoryId, so we
    //    set it via the per-card select before publishing (validateDraftForPublish
    //    enforces categoryId presence).
    await page.goto(`/admin/drafts/${batchId}`);
    await expect(page.locator("h2", { hasText: /Draft 1\/2/ })).toBeVisible();
    await expect(page.locator("h2", { hasText: /Draft 2\/2/ })).toBeVisible();

    // Set categoryId on both cards via the native <select> (id="<draftId>-category").
    const drafts = await prisma.productDraft.findMany({
      where: { batchId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    expect(drafts).toHaveLength(2);
    for (const d of drafts) {
      await page.selectOption(`#${d.id}-category`, category!.id);
    }
    // Wait for autosave (commitField via updateDraftAction) to flush.
    await page.waitForFunction(
      async () => {
        const rows = document.querySelectorAll('[role="status"]');
        return Array.from(rows).every((r) => !r.textContent?.includes("ukládám"));
      },
      null,
      { timeout: 5_000 },
    ).catch(() => {});
    // Belt-and-suspenders: assert DB rows now carry categoryId before we publish.
    await expect
      .poll(
        async () => {
          const rows = await prisma.productDraft.findMany({
            where: { batchId },
            select: { categoryId: true },
          });
          return rows.every((r) => r.categoryId === category!.id);
        },
        { timeout: 10_000, intervals: [500, 1_000] },
      )
      .toBe(true);

    // 8. Bulk publish.
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes(`/admin/drafts/${batchId}`) && resp.request().method() === "POST",
        { timeout: 15_000 },
      ).catch(() => null),
      page.getByRole("button", { name: /Publikovat vše/ }).click(),
    ]);

    // 9. Verify in DB — 2 Products created with our unique name prefix.
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

    const created = await prisma.product.findMany({
      where: { name: { startsWith: NAME_PREFIX } },
      select: { sku: true, active: true, sold: true, stock: true, slug: true },
    });
    for (const p of created) {
      expect(p.sku.startsWith("JN-")).toBe(true);
      expect(p.active).toBe(true);
      expect(p.sold).toBe(false);
      expect(p.stock).toBe(1);
      expect(p.slug.length).toBeGreaterThan(0);
    }

    // Drafts marked published; batch promoted to published when last draft flips.
    const finalDrafts = await prisma.productDraft.findMany({
      where: { batchId },
      select: { status: true, publishedProductId: true },
    });
    expect(finalDrafts.every((d) => d.status === "published")).toBe(true);
    expect(finalDrafts.every((d) => d.publishedProductId)).toBe(true);

    const finalBatch = await prisma.productDraftBatch.findUnique({
      where: { id: batchId },
      select: { status: true, publishedAt: true },
    });
    expect(finalBatch?.status).toBe("published");
    expect(finalBatch?.publishedAt).toBeTruthy();
  });

  test("guard: invalid token → 401 from /api/admin/drafts/auth, no cookie set", async ({
    request,
  }) => {
    // Bogus JWT — verifyDraftQrToken throws on signature, auth route returns
    // expiredResponse() with 401 + the "Odkaz vypršel" HTML page.
    const res = await request.get(
      "/api/admin/drafts/auth?token=eyJhbGciOiJIUzI1NiJ9.eyJiYXRjaElkIjoiZmFrZSIsImFkbWluSWQiOiJmYWtlIn0.invalid_signature_blob",
      { maxRedirects: 0 },
    );
    expect(res.status()).toBe(401);
    const html = await res.text();
    expect(html).toContain("Odkaz vypršel");

    // Missing token branch — same 401.
    const missing = await request.get("/api/admin/drafts/auth", {
      maxRedirects: 0,
    });
    expect(missing.status()).toBe(401);
  });

  test("guard: publish without name → errors[].reason='Chybí název', no Product row created", async ({
    page,
  }) => {
    const category = await prisma.category.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    test.skip(!category, "No category in dev DB");

    await loginAsAdmin(page);

    // 1. Start batch + auth — same handshake as happy path.
    const { batchId, qrUrl } = await startBatch(page.request);
    const token = extractToken(qrUrl);
    await page.goto(`/api/admin/drafts/auth?token=${encodeURIComponent(token)}`);
    await page.waitForURL(new RegExp(`/admin/drafts/${batchId}/mobile`), {
      timeout: 10_000,
    });

    // 2. Create one draft missing `name` (other publish-required fields filled
    //    so we isolate the name validation). The items API allows nullable name.
    //    page.request inherits the draft_session cookie from the auth redirect.
    //    Internal marker so afterAll cleanup can find any Product row that
    //    accidentally slips through validation.
    const itemRes = await page.request.post(
      `/api/admin/drafts/${batchId}/items`,
      {
        data: {
          // name intentionally omitted
          price: 199,
          condition: "excellent",
          categoryId: category!.id,
          sizes: ["M"],
          images: [`${R2_HOST}/products/qr-mock-noname.png`],
          internalNote: `${NAME_PREFIX}-noname-marker`,
        },
      },
    );
    expect(itemRes.ok(), `items POST failed: ${itemRes.status()}`).toBe(true);
    const { draftId } = (await itemRes.json()) as { draftId: string };

    // 3. Publish via API (admin auth from NextAuth cookie). The route shares
    //    its validate() with the server action, so this is the same gate.
    const publishRes = await page.request.post(
      `/api/admin/drafts/${batchId}/publish`,
      { data: { draftIds: [draftId] } },
    );
    expect(publishRes.ok()).toBe(true);
    const result = (await publishRes.json()) as {
      published: number;
      skipped: number;
      errors: { draftId: string; reason: string }[];
    };
    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].draftId).toBe(draftId);
    expect(result.errors[0].reason).toBe("Chybí název");

    // 4. Zero Product rows leaked through. Match by both internalNote marker
    //    (which never gets copied to Product, but covers the "Chybí název"
    //    edge where draft name is empty) AND the unique price + category.
    //    The strongest assertion is just: no Product whose name prefix
    //    matches our run AND no orphan Product tied to this draft.
    const draft = await prisma.productDraft.findUnique({
      where: { id: draftId },
      select: { status: true, publishedProductId: true },
    });
    expect(draft?.status).not.toBe("published");
    expect(draft?.publishedProductId).toBeNull();

    // Belt-check: scan recently created Products with our run-id-bearing
    // internalNote (publishOne would have copied it).
    const leaked = await prisma.product.findFirst({
      where: { internalNote: { contains: `${NAME_PREFIX}-noname-marker` } },
      select: { id: true },
    });
    expect(leaked).toBeNull();
  });
});
