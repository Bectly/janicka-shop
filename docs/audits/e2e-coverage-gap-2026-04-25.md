# E2E Coverage Gap Analysis — 2026-04-25

Phase 7 follow-up per `codebase-sweep-2026-04-18.md` line 1741. Surveys untested critical paths in the Janička shop after Phase 7 audit-debt close-out (C4910), prioritises gaps by revenue-path / data-integrity / regression-risk, and feeds 2–3 fresh Bolt tasks with concrete spec skeletons mirroring the `e2e/sold-pdp.spec.ts` size class (~84 lines, PrismaClient seed/teardown, skip-on-no-eligible-data, single happy-path assertion cluster).

## Current e2e/ inventory

| File | Lines | Coverage |
|---|---|---|
| `e2e/smoke.spec.ts` | 23 | Homepage smoke. |
| `e2e/cart.spec.ts` | 79 | Cart add/remove/quantity (#452 era). |
| `e2e/pdp.spec.ts` | 67 | PDP render + add-to-cart (#452 era). |
| `e2e/sold-pdp.spec.ts` | 93 | Sold widget collapse (#555) + back-in-stock-form regression assertion (#558) + similar-carousel ≥4 cards. |
| `e2e/checkout-flow.spec.ts` | 110 | Accordion checkout → mock payment → /order/JN-… page → Order row persisted with status=paid (#560). |
| `e2e/mock-payment.spec.ts` | 79 | Mock payment provider only. |
| `e2e/admin-jarvis.spec.ts` | 110 | Admin JARVIS page. |
| **Total** | **561** | 7 specs. |

Vitest unit-test coverage at 49/49 (lib/cron-metrics, lib/email-dedup, server-side primitives) but Playwright e2e is the only layer that can catch cross-process regressions on the email-dispatch pipelines and admin write paths.

## Untested critical paths — survey

### Gap A — Wishlist sold-item trigger (CHECKOUT → email dispatch)

- **Trigger**: `src/app/(shop)/checkout/actions.ts:543` calls `sendWishlistSoldNotifications(order.soldProducts)` fire-and-forget after the Order is finalised.
- **Fallback**: `src/app/api/cron/wishlist-sold-notify/route.ts` sweeps `WishlistSubscription` rows where `notifiedAt IS NULL` and the watched product has flipped to `sold=true`.
- **Dedup gate**: `checkAndRecordEmailDispatch(email, productId, "wishlist-sold")` inside `src/lib/email/wishlist-sold.ts:220`.
- **What is NOT tested today**: end-to-end wiring from a checkout-initiated sold flip → wishlist subscriber receiving the email + an `EmailDedupLog` row written + `WishlistSubscription.notifiedAt` updated. Unit tests cover the dedup helper in isolation; the e2e wiring (fire-and-forget + cross-table state harmony) is not exercised by any test.
- **Why this gap matters**:
  - **Revenue-path** (P1): 40% click-through-rate on wishlist-sold emails in second-hand fashion (Once Again case study, see project memory). Silent breakage = direct revenue loss on the unique-inventory model where the item is gone forever and the email is the only chance to redirect the buyer to a similar piece.
  - **Data-integrity** (P0): the dedup gate is the authoritative idempotency layer per Phase 7 KEY VERIFICATION on #556 — but it is verified only at the unit level. An e2e regression that double-sends across the cron path AND the checkout-fire path is not caught by any vitest spec.
  - **Regression-risk** (P0): touched directly by the last 2 cycles (#556 EmailDedupLog wrapper, #557 cron-metrics migration). Highest-recency change-blast radius in the e2e-uncovered surface.

### Gap B — BackInStock subscription dispatch (PDP → cron → email)

- **Trigger**: `src/components/shop/back-in-stock-form.tsx` submits via server action → row in `BackInStockSubscription`.
- **Dispatcher**: `src/app/api/cron/back-in-stock-notify/route.ts` matches subscription tuples (brand+category+size+condition) against products created in last 48h, sends email through `getMailer()`, marks `notifiedAt`, walks dedup gate.
- **What is NOT tested today**: subscription happy path → cron sweep → email dispatched → dedup row written → subscription marked notified. No e2e covers the form submission or the cron sweep.
- **Why this gap matters**:
  - **Revenue-path** (P1): back-in-stock emails are 22.45% conversion / 58% open rate in fashion (Klaviyo benchmarks via project memory). On the second-hand model where the cross-sell carousel is also a back-in-stock funnel, this email is co-equal with wishlist-sold.
  - **Data-integrity** (P1): `BackInStockSubscription.notifiedAt` AND `EmailDedupLog` must both write — current cron handles failure with `notifiedAt` update inside the dedup-blocked branch (#556), but cross-process behaviour is not asserted anywhere.
  - **Regression-risk** (P1): three cycles of churn (#554 carousel scoring, #555 widget collapse, #556 dedup, #557 cron-metrics). Same blast-radius cluster as Gap A.

### Gap C — Admin product-create happy path

- **Path**: `src/app/(admin)/admin/products/new/page.tsx` → `ProductForm` → `createProduct` server action → DB → product appears in `/products` listing + PDP renders.
- **What is NOT tested today**: nothing in e2e/ asserts the admin write path can produce a customer-visible product. Vitest covers some `createProduct` server-action validation in isolation but not the round-trip.
- **Why this gap matters**:
  - **Data-integrity** (P1): admin product-create is the ONLY inventory ingestion path in production today. Silent breakage = no new stock can be added (catastrophic).
  - **Revenue-path** (P2): not directly revenue-driving, but no new inventory = no future revenue.
  - **Regression-risk** (P3): touched rarely. Lower risk than A/B but the catastrophic blast radius justifies the test.
- **Caveat**: requires admin-auth setup in Playwright (NextAuth credentials) — increases spec complexity above the `sold-pdp.spec.ts` ~93-line baseline. May land at ~140–160 lines.

### Gap D — Abandoned-cart token-restore (#450)

- **Path**: `AbandonedCart` row persisted by checkout cart-capture cron → email with `?token={cuid}` link → `/cart?token=…` page → `POST /api/cart/restore?token=…` → Zustand cart hydrated → redirect to `/checkout`.
- **What is NOT tested today**: no e2e exercises the token-restore round-trip. Manual integration test only.
- **Why this gap matters**:
  - **Revenue-path** (P2): abandoned-cart recovery is 6.5x revenue per industry benchmarks. CZ-specific 50% instant-payment context means the email arrives while the buyer is still warm.
  - **Data-integrity** (P2): cross-device hydration is fragile by design — token format validation, expiry guard (7d), corrupt-JSON guard all live in `route.ts` but no e2e asserts they hold.
  - **Regression-risk** (P3): low-recency change. Lower priority than A/B/C.

## Prioritisation — final ranking

| Rank | Gap | Composite (revenue + integrity + regression) | Bolt task to file |
|---|---|---|---|
| 1 | **A — Wishlist sold-item trigger** | P1 + P0 + P0 = HIGHEST | `[E2E-WISHLIST-SOLD]` |
| 2 | **B — BackInStock subscription dispatch** | P1 + P1 + P1 = HIGH | `[E2E-BACK-IN-STOCK-DISPATCH]` |
| 3 | **C — Admin product-create** | P2 + P1 + P3 = MEDIUM-HIGH (catastrophic blast radius) | `[E2E-ADMIN-PRODUCT-CREATE]` |
| 4 | D — Abandoned-cart token-restore | P2 + P2 + P3 = MEDIUM | DEFER — file later if Bolt has bandwidth after 1–3 land. |

Filing 3 Bolt tasks (A/B/C). D deferred per the directive's "2–3 fresh Bolt tasks" budget.

## Spec skeletons (to be embedded in each Bolt task)

### Task A — `e2e/wishlist-sold-trigger.spec.ts` (~95 lines target)

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Wishlist sold-item trigger e2e — subscribes a unique email to a product's
// WishlistSubscription, flips that product to sold=true via direct DB update
// (simulating the post-checkout finalize step), invokes the wishlist-sold
// fallback cron with CRON_SECRET, asserts (a) WishlistSubscription.notifiedAt
// is set, (b) EmailDedupLog row exists with eventType="wishlist-sold" for the
// same email+productId, (c) re-running the cron does NOT create a second
// EmailDedupLog row (dedup gate authoritative).

const prisma = new PrismaClient();
const TEST_EMAIL = `wishlist-sold-e2e-${Date.now()}@test.local`;
let productId: string | null = null;
let subscriptionId: string | null = null;

test.beforeAll(async () => {
  const target = await prisma.product.findFirst({
    where: { active: true, sold: false },
    select: { id: true },
  });
  if (!target) return;
  productId = target.id;
  const sub = await prisma.wishlistSubscription.create({
    data: { email: TEST_EMAIL, productId: target.id },
    select: { id: true },
  });
  subscriptionId = sub.id;
  await prisma.product.update({ where: { id: target.id }, data: { sold: true } });
});

test.afterAll(async () => {
  if (subscriptionId) await prisma.wishlistSubscription.delete({ where: { id: subscriptionId } }).catch(() => {});
  await prisma.emailDedupLog.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
  if (productId) await prisma.product.update({ where: { id: productId }, data: { sold: false } }).catch(() => {});
  await prisma.$disconnect();
});

test.describe("Wishlist sold-item trigger", () => {
  test("cron dispatches → notifiedAt + EmailDedupLog written + idempotent on re-run", async ({ request }) => {
    test.skip(!productId, "No eligible product in dev DB");
    const cronSecret = process.env.CRON_SECRET;
    test.skip(!cronSecret, "CRON_SECRET not configured");

    const res = await request.get("/api/cron/wishlist-sold-notify", {
      headers: { Authorization: `Bearer ${cronSecret!}` },
    });
    expect(res.ok()).toBeTruthy();

    const sub = await prisma.wishlistSubscription.findUnique({ where: { id: subscriptionId! } });
    expect(sub?.notifiedAt).toBeTruthy();

    const dedupRows = await prisma.emailDedupLog.findMany({
      where: { email: TEST_EMAIL, productId: productId!, eventType: "wishlist-sold" },
    });
    expect(dedupRows.length).toBe(1);

    // Re-run cron → no second EmailDedupLog row (dedup gate authoritative).
    await request.get("/api/cron/wishlist-sold-notify", {
      headers: { Authorization: `Bearer ${cronSecret!}` },
    });
    const dedupRowsAfter = await prisma.emailDedupLog.findMany({
      where: { email: TEST_EMAIL, productId: productId!, eventType: "wishlist-sold" },
    });
    expect(dedupRowsAfter.length).toBe(1);
  });
});
```

Notes for implementer:
- Skip gracefully when no eligible product OR `CRON_SECRET` missing — pattern matches `sold-pdp.spec.ts:54` skip class.
- Use prisma direct DB access for setup/teardown (no UI submission) — keeps spec under 100 lines.
- The test does NOT assert that the email is delivered (SMTP is project gate, not test concern); it asserts the dedup-row + notifiedAt-flag invariants which are the data-integrity contract.
- Wire into `playwright.config.ts` if not already covered by glob.

### Task B — `e2e/back-in-stock-dispatch.spec.ts` (~110 lines target)

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// BackInStock dispatch e2e — creates a BackInStockSubscription tuple matching
// a freshly-restocked product (categoryId + brand + size from a real product
// flipped via direct DB update), invokes the back-in-stock-notify cron, asserts
// (a) BackInStockSubscription.notifiedAt + notifiedProductId set, (b)
// EmailDedupLog row written with eventType="back-in-stock", (c) cron re-run
// does NOT re-fire (dedup gate authoritative).

const prisma = new PrismaClient();
const TEST_EMAIL = `back-in-stock-e2e-${Date.now()}@test.local`;
let productId: string | null = null;
let subscriptionId: string | null = null;
let originalCreatedAt: Date | null = null;

test.beforeAll(async () => {
  // Pick a recent-ish product, force its createdAt forward into the 48h window
  // so the cron candidate query matches it.
  const target = await prisma.product.findFirst({
    where: { active: true, sold: false, brand: { not: null } },
    select: { id: true, brand: true, sizes: true, categoryId: true, createdAt: true },
  });
  if (!target) return;
  productId = target.id;
  originalCreatedAt = target.createdAt;

  let firstSize: string | null = null;
  try {
    const arr = JSON.parse(target.sizes);
    if (Array.isArray(arr) && typeof arr[0] === "string") firstSize = arr[0];
  } catch { /* ignore */ }

  const sub = await prisma.backInStockSubscription.create({
    data: {
      email: TEST_EMAIL,
      categoryId: target.categoryId,
      brand: target.brand,
      size: firstSize,
      condition: null,
    },
    select: { id: true },
  });
  subscriptionId = sub.id;
  // Push createdAt forward so the 48h window matches.
  await prisma.product.update({
    where: { id: target.id },
    data: { createdAt: new Date() },
  });
});

test.afterAll(async () => {
  if (subscriptionId) await prisma.backInStockSubscription.delete({ where: { id: subscriptionId } }).catch(() => {});
  await prisma.emailDedupLog.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
  if (productId && originalCreatedAt) {
    await prisma.product.update({
      where: { id: productId },
      data: { createdAt: originalCreatedAt },
    }).catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Back-in-stock subscription dispatch", () => {
  test("cron matches tuple → notifiedAt + EmailDedupLog written + idempotent", async ({ request }) => {
    test.skip(!productId || !subscriptionId, "No eligible product in dev DB");
    const cronSecret = process.env.CRON_SECRET;
    test.skip(!cronSecret, "CRON_SECRET not configured");

    const res = await request.get("/api/cron/back-in-stock-notify", {
      headers: { Authorization: `Bearer ${cronSecret!}` },
    });
    expect(res.ok()).toBeTruthy();

    const sub = await prisma.backInStockSubscription.findUnique({ where: { id: subscriptionId! } });
    expect(sub?.notifiedAt).toBeTruthy();
    expect(sub?.notifiedProductId).toBeTruthy();

    const dedupRows = await prisma.emailDedupLog.findMany({
      where: { email: TEST_EMAIL, eventType: "back-in-stock" },
    });
    expect(dedupRows.length).toBe(1);

    // Re-run → idempotent.
    await request.get("/api/cron/back-in-stock-notify", {
      headers: { Authorization: `Bearer ${cronSecret!}` },
    });
    const after = await prisma.emailDedupLog.findMany({
      where: { email: TEST_EMAIL, eventType: "back-in-stock" },
    });
    expect(after.length).toBe(1);
  });
});
```

Notes for implementer:
- Same skip-on-no-data + skip-on-missing-CRON_SECRET pattern.
- `createdAt` mutation is necessary because the cron filters on a 48h-fresh window — most dev DB products are older than 48h.
- Restore `createdAt` in `afterAll` to avoid leaking state into other specs.

### Task C — `e2e/admin-product-create.spec.ts` (~140 lines target — admin auth required)

```ts
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Admin product-create happy path e2e — logs in as admin (NextAuth credentials),
// navigates to /admin/products/new, fills the ProductForm with required fields
// + a unique slug, submits, asserts (a) the product row exists in DB with
// active=true sold=false, (b) the public PDP /products/<slug> renders 200 with
// the product name visible, (c) the product appears in the /products listing.
// Cleans up the created product in afterAll.

const prisma = new PrismaClient();
const SLUG = `e2e-product-${Date.now()}`;
let createdProductId: string | null = null;

test.afterAll(async () => {
  if (createdProductId) {
    await prisma.product.delete({ where: { id: createdProductId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Admin product-create happy path", () => {
  test("admin form → DB row + public PDP renders + listing includes new product", async ({ page }) => {
    const adminUser = process.env.E2E_ADMIN_EMAIL;
    const adminPass = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!adminUser || !adminPass, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not configured");

    // Log in via NextAuth credentials provider.
    await page.goto("/admin/login");
    await page.fill('input[name="email"]', adminUser!);
    await page.fill('input[name="password"]', adminPass!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/admin/, { timeout: 10_000 });

    // Pick a category.
    const category = await prisma.category.findFirst({ select: { id: true, slug: true } });
    expect(category, "no category in dev DB").toBeTruthy();

    await page.goto("/admin/products/new");
    await page.fill('input[name="name"]', `E2E Test Product ${SLUG}`);
    await page.fill('input[name="slug"]', SLUG);
    await page.fill('input[name="price"]', "499");
    await page.selectOption('select[name="categoryId"]', category!.id);
    // Sizes / brand / condition fields filled per ProductForm contract — adjust
    // selectors to match actual form. Assume a description editor is optional.
    await page.click('button[type="submit"]');

    // Server action revalidates products + admin caches → wait for navigation.
    await page.waitForURL(/\/admin\/products/, { timeout: 10_000 });

    // Assert DB write.
    const created = await prisma.product.findUnique({
      where: { slug: SLUG },
      select: { id: true, active: true, sold: false },
    });
    expect(created).toBeTruthy();
    createdProductId = created!.id;
    expect(created!.active).toBe(true);
    expect(created!.sold).toBe(false);

    // Assert public PDP renders.
    await page.goto(`/products/${SLUG}`);
    await expect(page.getByText(`E2E Test Product ${SLUG}`).first()).toBeVisible();

    // Assert /products listing includes the new product.
    await page.goto("/products");
    await expect(page.getByRole("link", { name: new RegExp(SLUG) }).first()).toBeVisible();
  });
});
```

Notes for implementer:
- This is the LARGEST spec of the three (~140 lines). Admin-auth setup raises complexity above the `sold-pdp.spec.ts` baseline.
- `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` should be env-gated and created via a setup script (or seed an admin user once in `playwright.config.ts` globalSetup if Bolt prefers a single auth setup).
- The form selectors are best-guess — implementer should `Read` `src/components/admin/product-form.tsx` and adjust before running.
- Consider `playwright.config.ts` `storageState` pattern for amortising login across multiple admin specs in future.

## Out-of-scope for this cycle (deferred)

- **Gap D — Abandoned-cart token-restore**: defer to next round. Lower composite priority and the cart restoration is exercised manually with each `/cart?token=` deploy.
- **Wishlist UI submission e2e**: the dedup invariants are exercised by Gap A. UI flow can be added later.
- **Cross-sell cron `/api/cron/cross-sell` + `/api/cron/similar-items`**: similar shape to A/B; once A and B land they become a copy-paste class.

## Streaks at filing

- Green-gate streak: **21 cycles** (C4889 → C4911).
- Lint-zero streak: **44 commits**.
- Vitest: **49/49** at HEAD `aeb1b4c`.
- Phase 7 audit-debt: **CLEARED at C4910**.

## Bolt next-cycle dispatch

Three new tasks filed against `devloop_tasks`:

- `#NEW-A` BOLT [E2E-WISHLIST-SOLD] — Gap A spec, ~95 lines.
- `#NEW-B` BOLT [E2E-BACK-IN-STOCK-DISPATCH] — Gap B spec, ~110 lines.
- `#NEW-C` BOLT [E2E-ADMIN-PRODUCT-CREATE] — Gap C spec, ~140 lines + admin auth setup.

Recommended sequencing for Bolt: A (highest blast-radius), then B (sibling test class, ~50% spec reuse), then C (heavier setup cost, lower urgency). Tasks A and B together should land in one cycle; C may need its own cycle.
