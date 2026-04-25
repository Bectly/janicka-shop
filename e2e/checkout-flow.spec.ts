import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Checkout golden path — seeds a unique product, walks the accordion checkout
// against the mock payment provider, asserts we land on the paid order page
// AND that the Order row was actually written with status=paid + linked
// OrderItem pointing at the seeded product. Defends the revenue path against
// regressions in checkout-adjacent code (cart, address forms, mock gate,
// payment-return → order page redirect, post-payment Order persistence).
// Skips when PAYMENT_PROVIDER != mock or when the dev DB has no Category.

const prisma = new PrismaClient();

const stamp = Date.now();
const customerEmail = `e2e-checkout-${stamp}@example.com`;
let seededProductId: string | null = null;
let seededProductSlug: string | null = null;

test.beforeAll(async () => {
  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) return;
  const product = await prisma.product.create({
    data: {
      name: `E2E Checkout ${stamp}`,
      slug: `e2e-checkout-${stamp}`,
      sku: `E2E-CHK-${stamp}`,
      description: "E2E checkout-flow seeded product — safe to delete.",
      price: 199,
      categoryId: category.id,
      stock: 1,
      active: true,
      sold: false,
    },
    select: { id: true, slug: true },
  });
  seededProductId = product.id;
  seededProductSlug = product.slug;
});

test.afterAll(async () => {
  const customer = await prisma.customer.findUnique({
    where: { email: customerEmail },
    select: { id: true },
  });
  if (customer) {
    const orders = await prisma.order.findMany({
      where: { customerId: customer.id },
      select: { id: true },
    });
    for (const o of orders) {
      await prisma.orderItem.deleteMany({ where: { orderId: o.id } });
    }
    await prisma.order.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
  }
  if (seededProductId) {
    await prisma.product.delete({ where: { id: seededProductId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

test.describe("Checkout golden path — seeded product → mock pay → paid Order", () => {
  test("walks accordion checkout, lands on paid order page, persists Order row", async ({
    page,
  }) => {
    test.skip(!seededProductSlug, "No category available to seed product");

    await page.goto(`/products/${seededProductSlug}`);
    await page.getByRole("button", { name: /P.idat do ko..ku/i }).click();
    await expect(
      page.getByRole("button", { name: /P.id.no do ko..ku|Ji. v ko..ku/i }),
    ).toBeVisible();

    await page.goto("/checkout");
    const mockBanner = page.getByText(/Testovac.{0,2} re.im/i).first();
    if (!(await mockBanner.isVisible().catch(() => false))) {
      test.skip(true, "PAYMENT_PROVIDER != mock — checkout test-mode banner missing");
    }

    await page.getByLabel("Jméno").fill("E2E");
    await page.getByLabel("Příjmení").fill("Checkout");
    await page.getByLabel("Email").fill(customerEmail);
    await page.getByRole("button", { name: /^Pokračovat$/ }).first().click();

    await page.getByText("Česká pošta").click();
    await page.getByLabel("Telefon").fill("+420123456789");
    await page.getByLabel("Ulice a číslo popisné").fill("Testovací 1");
    await page.getByLabel("Město").fill("Praha");
    await page.getByLabel("PSČ").fill("11000");
    await page.getByRole("button", { name: /^Pokračovat$/ }).first().click();

    await page.getByRole("button", { name: /Pokračovat ke shrnutí/ }).click();
    await page.getByRole("button", { name: /Zaplatit kartou/ }).click();

    await page.waitForURL(/\/checkout\/mock-payment/, { timeout: 15_000 });
    await page.getByRole("button", { name: /^Zaplatit$/ }).click();

    await page.waitForURL(/\/order\/JN-[^?]+\?token=/, { timeout: 15_000 });
    const orderNumber = page.url().match(/\/order\/(JN-[^?]+)\?/)?.[1];
    expect(orderNumber).toBeTruthy();

    const order = await prisma.order.findUnique({
      where: { orderNumber: orderNumber! },
      include: { items: true },
    });
    expect(order).not.toBeNull();
    expect(order!.status).toBe("paid");
    expect(order!.items.some((i) => i.productId === seededProductId)).toBe(true);
  });
});
