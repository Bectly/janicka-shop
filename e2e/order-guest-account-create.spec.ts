import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Post-purchase guest→registered account-creation e2e (Phase 9 bundle —
// closes C4927 trace_p1 deferred-list gap, the post-purchase #567 path that
// landed without e2e protection).
//
// What it covers:
//   The order-confirmation page (/order/[orderNumber]?token=…) renders a
//   `CreateAccountCard` when the order's customer has no password set
//   (showAccountCreation = !order.customer.password — see
//   src/app/(shop)/order/[orderNumber]/page.tsx:65,306). The card calls the
//   `createAccountFromOrder` server action which hashes the password and
//   patches Customer.password (see actions.ts in the same directory). After
//   success the card flips to a "Účet vytvořen!" confirmation.
//
// Note on task wording vs. reality: the Lead task description mentioned
// "click → /signup hydration carries email + orderNumber prefill". There is
// NO /signup page in this codebase — the post-purchase upgrade is inline on
// /order/[orderNumber] via CreateAccountCard. The spec follows the actual
// code path: render CTA, submit password, assert Customer.password is now
// set in DB.
//
// W-12 fix (cross-spec race under fullyParallel:true): the customer email +
// order number are stamped with a unique `${Date.now()}-${random}` suffix
// so concurrent specs cannot collide on the unique constraints. The email
// shape `<prefix>-e2e-<unique>@test.local` matches the W-9b globalTeardown
// sweep class so a SIGKILL'd run still gets cleaned up.

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TEST_EMAIL = `guest-account-e2e-${UNIQUE}@test.local`;
const ORDER_NUMBER = `E2E-GUEST-${UNIQUE}`;
const ACCESS_TOKEN = `e2e${UNIQUE.replace(/-/g, "")}`;
const PASSWORD = "E2eTestPassword!23";

let seededCustomerId: string | null = null;
let seededOrderId: string | null = null;

test.beforeAll(async () => {
  const customer = await prisma.customer.create({
    data: {
      email: TEST_EMAIL,
      firstName: "E2E",
      lastName: "Guest",
      // password intentionally null — guest checkout shape that triggers
      // the CreateAccountCard render branch.
    },
    select: { id: true },
  });
  seededCustomerId = customer.id;

  const order = await prisma.order.create({
    data: {
      orderNumber: ORDER_NUMBER,
      accessToken: ACCESS_TOKEN,
      customerId: customer.id,
      status: "paid", // skip the pending banner / QR codepath
      paymentMethod: "card",
      shippingMethod: "packeta_home",
      shippingName: "E2E Guest",
      shippingStreet: "Testovací 1",
      shippingCity: "Praha",
      shippingZip: "11000",
      subtotal: 499,
      shipping: 0,
      total: 499,
    },
    select: { id: true },
  });
  seededOrderId = order.id;
});

test.afterAll(async () => {
  if (seededOrderId) {
    await prisma.order.delete({ where: { id: seededOrderId } }).catch(() => {});
  }
  if (seededCustomerId) {
    await prisma.customer
      .delete({ where: { id: seededCustomerId } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Post-purchase guest → registered account creation", () => {
  test("CreateAccountCard renders for password-less customer; submit hashes Customer.password", async ({
    page,
  }) => {
    test.skip(!seededOrderId, "Seed failed — Order/Customer not created");

    // 1. Hit the order confirmation page with the access token.
    const response = await page.goto(
      `/order/${ORDER_NUMBER}?token=${encodeURIComponent(ACCESS_TOKEN)}`,
    );
    expect(response?.status()).toBeLessThan(400);

    // 2. The CreateAccountCard heading is the canonical CTA — guards against
    //    flaky text matches by binding to the heading role.
    await expect(
      page.getByRole("heading", { name: "Nakupuj příště rychleji" }),
    ).toBeVisible({ timeout: 10_000 });

    // 3. Fill the password input (id="create-password" in
    //    src/components/shop/create-account-card.tsx). The form gates submit
    //    on length>=8 client-side AND the createAccountFromOrder zod schema
    //    re-validates server-side.
    await page.fill("#create-password", PASSWORD);

    // 4. Submit — server action runs, success state replaces the form.
    await page.getByRole("button", { name: /Uložit a vytvořit účet/ }).click();

    // 5. Success copy renders in place of the form (see CreateAccountCard
    //    `created` branch). Generous timeout covers bcrypt hash (cost=12,
    //    ~250ms) + Prisma round-trip + React transition.
    await expect(
      page.getByText(/Účet vytvořen/),
    ).toBeVisible({ timeout: 10_000 });

    // 6. DB round-trip — Customer.password is now a bcrypt hash. We only
    //    assert non-null since the hash is non-deterministic, but cheap shape
    //    check (bcryptjs hashes start with `$2`) catches a malformed write.
    const updated = await prisma.customer.findUnique({
      where: { id: seededCustomerId! },
      select: { password: true },
    });
    expect(updated?.password, "customer.password not persisted").toBeTruthy();
    expect(updated!.password!.startsWith("$2")).toBe(true);
  });
});
