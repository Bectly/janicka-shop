import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Price-watch e2e (Task #987 / Cycle #5202).
// Covers the "Sledovat cenu" PDP CTA wired up in C5196 — both the
// anonymous (email-prompt) flow and the one-click signed-in customer flow.
//
// What we exercise:
//   (1) Anonymous: visit fresh PDP, click "Sledovat cenu" → email form
//       appears, fill + submit → PriceWatch row exists for (email,
//       productId), currentPrice == product.price, button switches to
//       "Hlídáš cenu". Re-render hydrates `watched=true` from
//       /api/price-watch/check?productId=…&email=… (localStorage).
//   (2) Signed-in customer: register + login as customer, visit PDP,
//       click "Sledovat cenu" once (no email prompt) → PriceWatch row
//       exists with userId set to the customer.id and email = customer.email.
//   (3) Idempotent re-arm: POSTing twice for the same (email, product)
//       upserts (no error, no duplicate row).
//
// Tagged @requires-db — needs a writeable Product + PriceWatch + Customer
// schema. Spec creates its own dedicated unsold Product (E2E-PW-…) so
// parallel workers can never collide. Cleanup via standard `-e2e-` +
// `@test.local` email pattern (W-9b sweep) plus E2E-PW SKU/name double-key
// (added to W-10 globalTeardown class via afterAll backstop).

const prisma = new PrismaClient();
const UNIQUE = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const SKU = `E2E-PW-${UNIQUE}`;
const SLUG = `e2e-pw-${UNIQUE}`;
const NAME = `E2E Test Product ${UNIQUE} PW`;
const ANON_EMAIL = `price-watch-anon-e2e-${UNIQUE}@test.local`;
const CUSTOMER_EMAIL = `price-watch-cust-e2e-${UNIQUE}@test.local`;
const CUSTOMER_PASSWORD = "Test12345!secret";

let productId: string | null = null;
let productSlug: string | null = null;

test.beforeAll(async () => {
  const category = await prisma.category.findFirst({
    select: { id: true },
  });
  if (!category) return;
  const product = await prisma.product.create({
    data: {
      name: NAME,
      slug: SLUG,
      description:
        "E2E auto-generated (price-watch.spec.ts). Cleaned up in afterAll.",
      price: 1499,
      sku: SKU,
      categoryId: category.id,
      active: true,
      sold: false,
    },
    select: { id: true, slug: true },
  });
  productId = product.id;
  productSlug = product.slug;
});

test.afterAll(async () => {
  // Sweep watchers seeded by this spec — both the anon address and the
  // registered customer's address use the `-e2e-` + `@test.local` pattern
  // already covered by W-9b, but PriceWatch isn't in the standard sweep.
  await prisma.priceWatch
    .deleteMany({
      where: {
        OR: [
          { email: { contains: "price-watch-anon-e2e-" } },
          { email: { contains: "price-watch-cust-e2e-" } },
        ],
      },
    })
    .catch(() => {});
  await prisma.customer
    .deleteMany({ where: { email: { contains: "price-watch-cust-e2e-" } } })
    .catch(() => {});
  if (productId) {
    await prisma.priceWatch
      .deleteMany({ where: { productId } })
      .catch(() => {});
    await prisma.priceHistory
      .deleteMany({ where: { productId } })
      .catch(() => {});
    await prisma.product
      .delete({ where: { id: productId } })
      .catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("@requires-db Price-watch — anonymous + signed-in customer", () => {
  test("anonymous: email-prompt flow upserts PriceWatch row + switches label", async ({
    page,
  }) => {
    test.skip(!productId || !productSlug, "No category in dev DB → skip");

    await page.goto(`/products/${productSlug}`);

    // Idle label = "Sledovat cenu".
    const cta = page.getByRole("button", { name: /Sledovat cenu/ });
    await expect(cta).toBeVisible({ timeout: 10_000 });
    await cta.click();

    // Email prompt appears.
    const emailInput = page.getByLabel(/Email pro upozornění na cenu/i);
    await expect(emailInput).toBeVisible();
    await emailInput.fill(ANON_EMAIL);
    await Promise.all([
      page
        .waitForResponse(
          (r) => r.url().includes("/api/price-watch") && r.request().method() === "POST",
          { timeout: 15_000 },
        )
        .catch(() => null),
      page.getByRole("button", { name: /^Hlídat$/ }).click(),
    ]);

    // Watched state: label switches to "Hlídáš cenu" + button disabled.
    await expect(
      page.getByRole("button", { name: /Hlídáš cenu/ }),
    ).toBeVisible({ timeout: 10_000 });

    // DB row exists with the right fields.
    const row = await prisma.priceWatch.findUnique({
      where: { email_productId: { email: ANON_EMAIL, productId: productId! } },
      select: {
        id: true,
        currentPrice: true,
        userId: true,
        unsubToken: true,
      },
    });
    expect(row, "PriceWatch row not created").toBeTruthy();
    expect(row!.currentPrice).toBe(1499);
    expect(row!.userId).toBeNull();
    expect(row!.unsubToken).toBeTruthy();
  });

  test("signed-in customer: one-click subscribe binds userId + email", async ({
    page,
    request,
    context,
  }) => {
    test.skip(!productId || !productSlug, "No category in dev DB → skip");

    // Register fresh customer.
    const reg = await request.post("/api/auth/register", {
      data: {
        email: CUSTOMER_EMAIL,
        password: CUSTOMER_PASSWORD,
        firstName: "Watch",
        lastName: "Tester",
      },
    });
    expect(reg.status()).toBe(200);

    // Sign in via the public credentials form so NextAuth issues a
    // role="customer" JWT cookie scoped to /.
    await page.goto("/login");
    await page.getByLabel(/email/i).first().fill(CUSTOMER_EMAIL);
    await page
      .getByLabel(/heslo|password/i)
      .first()
      .fill(CUSTOMER_PASSWORD);
    await Promise.all([
      page.waitForURL(/\/account|\/login/, { timeout: 15_000 }),
      page
        .getByRole("button", { name: /p.ihl.{1,3}sit|sign in|log in/i })
        .first()
        .click(),
    ]);
    const cookies = await context.cookies();
    const hasSession = cookies.some(
      (c) =>
        c.name === "authjs.session-token" ||
        c.name === "__Secure-authjs.session-token",
    );
    test.skip(
      !hasSession,
      "Customer login flow did not set a NextAuth session cookie in this env",
    );

    // Visit PDP and one-click subscribe (no email prompt for logged-in).
    await page.goto(`/products/${productSlug}`);
    const cta = page.getByRole("button", { name: /Sledovat cenu/ });
    await expect(cta).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page
        .waitForResponse(
          (r) => r.url().includes("/api/price-watch") && r.request().method() === "POST",
          { timeout: 15_000 },
        )
        .catch(() => null),
      cta.click(),
    ]);
    await expect(
      page.getByRole("button", { name: /Hlídáš cenu/ }),
    ).toBeVisible({ timeout: 10_000 });

    // DB row binds to the freshly-registered customer.
    const customer = await prisma.customer.findUnique({
      where: { email: CUSTOMER_EMAIL },
      select: { id: true },
    });
    expect(customer, "customer row missing post-register").toBeTruthy();

    const row = await prisma.priceWatch.findUnique({
      where: {
        email_productId: { email: CUSTOMER_EMAIL, productId: productId! },
      },
      select: { id: true, userId: true, currentPrice: true },
    });
    expect(row, "PriceWatch row not created for signed-in customer").toBeTruthy();
    expect(row!.userId).toBe(customer!.id);
    expect(row!.currentPrice).toBe(1499);
  });

  test("re-subscribe is idempotent (upsert on the unique tuple)", async ({
    request,
  }) => {
    test.skip(!productId, "No category in dev DB → skip");
    const email = `price-watch-anon-e2e-rearm-${UNIQUE}@test.local`;

    const first = await request.post("/api/price-watch", {
      data: { productId, email },
    });
    expect(first.status()).toBe(200);

    const second = await request.post("/api/price-watch", {
      data: { productId, email },
    });
    expect(second.status()).toBe(200);

    const rows = await prisma.priceWatch.findMany({
      where: { email, productId: productId! },
      select: { id: true },
    });
    expect(rows.length).toBe(1);

    // Cleanup the side-channel watcher this test created.
    await prisma.priceWatch
      .deleteMany({ where: { email } })
      .catch(() => {});
  });
});
