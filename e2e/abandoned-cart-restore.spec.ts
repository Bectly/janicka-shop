import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Abandoned-cart token-restore round-trip e2e (Gap D — docs/audits/e2e-coverage-gap-2026-04-25.md
// deferred-list line 340). Exercises the revenue-recovery path that the
// abandoned-cart email links rely on: a one-click URL with an opaque cuid token
// that hydrates the customer's cart on any device and bounces them to checkout.
//
// Coverage:
//   (1) Happy path — POST /api/cart/restore?token={cuid} → 200 + items[] payload.
//   (2) Token-format guard — non-cuid (`!`, too long, empty) → 400 "Invalid token".
//   (3) Status guard — recovered/expired AbandonedCart → 404 "Cart not available".
//   (4) Expiry guard — AbandonedCart older than 7 days → 410 "Cart expired".
//   (5) Corrupt-JSON guard — malformed cartItems blob → 422 "Corrupt cart data"
//       (route returns 422 Unprocessable Entity, not 500 — client data shape, not
//       server error). Both JSON.parse failure AND non-array payload covered.
//   (6) Page round-trip — navigate to /cart?restore={token} → success state
//       renders → 1.5s timer pushes router to /checkout (page.tsx:69).
//
// W-12 fix (cross-spec race under fullyParallel:true): each AbandonedCart row
// uses a unique email `abandoned-cart-e2e-${UNIQUE}@test.local` so concurrent
// specs cannot collide on the same row. The `-e2e-` + `@test.local` shape
// matches the W-9b globalTeardown sweep class (AbandonedCart added C4925).

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TEST_EMAIL = `abandoned-cart-e2e-${UNIQUE}@test.local`;
const E2E_ID_PREFIX = `E2E-CART-${UNIQUE}`;

const HAPPY_ITEMS = [
  {
    productId: `${E2E_ID_PREFIX}-PROD-1`,
    name: "E2E Restored Item",
    price: 499,
    slug: "e2e-restored-item",
    image: "",
    size: "M",
    color: "",
  },
];

let happyId: string | null = null;
let recoveredId: string | null = null;
let expiredId: string | null = null;
let corruptId: string | null = null;
let nonArrayId: string | null = null;
let pageRoundTripId: string | null = null;

test.beforeAll(async () => {
  const happy = await prisma.abandonedCart.create({
    data: {
      email: TEST_EMAIL,
      cartItems: JSON.stringify(HAPPY_ITEMS),
      cartTotal: 499,
      status: "pending",
    },
    select: { id: true },
  });
  happyId = happy.id;

  const recovered = await prisma.abandonedCart.create({
    data: {
      email: TEST_EMAIL,
      cartItems: JSON.stringify(HAPPY_ITEMS),
      cartTotal: 499,
      status: "recovered",
    },
    select: { id: true },
  });
  recoveredId = recovered.id;

  // 7d cutoff — backdate createdAt to 8 days ago via raw update (Prisma
  // doesn't allow setting createdAt on create when @default(now()) is in
  // play). status stays "pending" so only the age guard fires.
  const expired = await prisma.abandonedCart.create({
    data: {
      email: TEST_EMAIL,
      cartItems: JSON.stringify(HAPPY_ITEMS),
      cartTotal: 499,
      status: "pending",
    },
    select: { id: true },
  });
  expiredId = expired.id;
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  await prisma.$executeRaw`UPDATE AbandonedCart SET createdAt = ${eightDaysAgo} WHERE id = ${expiredId}`;

  const corrupt = await prisma.abandonedCart.create({
    data: {
      email: TEST_EMAIL,
      cartItems: "{not valid json",
      cartTotal: 0,
      status: "pending",
    },
    select: { id: true },
  });
  corruptId = corrupt.id;

  const nonArray = await prisma.abandonedCart.create({
    data: {
      email: TEST_EMAIL,
      // valid JSON, wrong shape — exercises the Array.isArray guard distinct
      // from the JSON.parse catch.
      cartItems: JSON.stringify({ not: "an array" }),
      cartTotal: 0,
      status: "pending",
    },
    select: { id: true },
  });
  nonArrayId = nonArray.id;

  const pageCart = await prisma.abandonedCart.create({
    data: {
      email: TEST_EMAIL,
      cartItems: JSON.stringify(HAPPY_ITEMS),
      cartTotal: 499,
      status: "pending",
    },
    select: { id: true },
  });
  pageRoundTripId = pageCart.id;
});

test.afterAll(async () => {
  await prisma.abandonedCart
    .deleteMany({ where: { email: TEST_EMAIL } })
    .catch(() => {});
  await prisma.$disconnect();
});

test.describe("Abandoned-cart token-restore — round-trip + guard rails", () => {
  test("API: happy path returns 200 + items payload", async ({ request }) => {
    test.skip(!happyId, "AbandonedCart seed missing");
    const res = await request.post(
      `/api/cart/restore?token=${encodeURIComponent(happyId!)}`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { items?: unknown };
    expect(Array.isArray(body.items)).toBe(true);
    expect((body.items as Array<{ productId: string }>)[0]?.productId).toBe(
      HAPPY_ITEMS[0]!.productId,
    );
  });

  test("API: token-format validation rejects non-alphanumeric / oversized / empty", async ({
    request,
  }) => {
    const cases = [
      "", // empty
      "has-dash-and-symbols!", // non-alphanumeric chars (regex /^[a-z0-9]+$/i)
      "a".repeat(65), // length > 64
    ];
    for (const bad of cases) {
      const res = await request.post(
        `/api/cart/restore?token=${encodeURIComponent(bad)}`,
      );
      expect(res.status()).toBe(400);
    }
  });

  test("API: non-pending status returns 404", async ({ request }) => {
    test.skip(!recoveredId, "AbandonedCart seed missing");
    const res = await request.post(
      `/api/cart/restore?token=${encodeURIComponent(recoveredId!)}`,
    );
    expect(res.status()).toBe(404);
  });

  test("API: cart older than 7 days returns 410 Gone", async ({ request }) => {
    test.skip(!expiredId, "AbandonedCart seed missing");
    const res = await request.post(
      `/api/cart/restore?token=${encodeURIComponent(expiredId!)}`,
    );
    expect(res.status()).toBe(410);
  });

  test("API: corrupt-JSON cartItems returns 422 (not 500)", async ({
    request,
  }) => {
    test.skip(!corruptId, "AbandonedCart seed missing");
    const res = await request.post(
      `/api/cart/restore?token=${encodeURIComponent(corruptId!)}`,
    );
    expect(res.status()).toBe(422);
  });

  test("API: non-array cartItems returns 422 (not 500)", async ({
    request,
  }) => {
    test.skip(!nonArrayId, "AbandonedCart seed missing");
    const res = await request.post(
      `/api/cart/restore?token=${encodeURIComponent(nonArrayId!)}`,
    );
    expect(res.status()).toBe(422);
  });

  test("Page round-trip: /cart?restore={token} renders success and redirects to /checkout", async ({
    page,
  }) => {
    test.skip(!pageRoundTripId, "AbandonedCart seed missing");
    await page.goto(`/cart?restore=${encodeURIComponent(pageRoundTripId!)}`);
    // Cart page UI string while restoring or after success — see
    // src/app/(shop)/cart/page.tsx:128-134.
    await expect(
      page.getByRole("heading", { name: /Košík obnoven|Obnovuji košík/ }),
    ).toBeVisible({ timeout: 10_000 });
    // page.tsx:69 — setTimeout(() => router.push("/checkout"), 1500).
    await page.waitForURL(/\/checkout(\?|$)/, { timeout: 10_000 });
  });
});
