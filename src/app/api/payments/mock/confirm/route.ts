import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getPaymentProviderName } from "@/lib/payments/provider";
import { setMockStatus } from "@/lib/payments/mock";
import { processPaymentStatus } from "@/lib/payments/process-status";
import { revalidatePath } from "next/cache";

/**
 * POST /api/payments/mock/confirm
 *
 * Simulates a payment gateway webhook for the mock provider. The mock gate page
 * calls this with either { outcome: "paid" } or { outcome: "declined" }.
 * Advances the order through the same state-transition helper as the real
 * Comgate webhook, so emails, Heureka logging, and admin notifications fire.
 *
 * Hard-guarded: refuses if PAYMENT_PROVIDER !== "mock".
 */

const bodySchema = z.object({
  orderNumber: z.string().min(1).max(64).regex(/^JN-/),
  transId: z.string().min(1).max(128),
  token: z.string().min(1).max(256),
  outcome: z.enum(["paid", "declined"]),
});

export async function POST(req: NextRequest) {
  await connection();

  if (getPaymentProviderName() !== "mock") {
    return NextResponse.json(
      { error: "Mock payment provider is not enabled" },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }
  const { orderNumber, transId, token, outcome } = parsed.data;

  const db = await getDb();
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      accessToken: true,
      status: true,
      paymentId: true,
    },
  });

  // Generic 403 for both missing order and token mismatch (avoid enumeration)
  if (!order || order.accessToken !== token) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  // Store transId on the order on first call so payment-return can look it up.
  if (order.paymentId !== transId) {
    await db.order.update({
      where: { id: order.id },
      data: { paymentId: transId },
    });
  }

  const nextStatus = outcome === "paid" ? "PAID" : "CANCELLED";
  setMockStatus(transId, nextStatus);

  await processPaymentStatus(order.id, order.status, nextStatus, "mock");

  // Revalidate ISR like the Comgate webhook does
  const orderItems = await db.orderItem.findMany({
    where: { orderId: order.id },
    select: { productId: true },
  });
  const products = await db.product.findMany({
    where: { id: { in: orderItems.map((i) => i.productId) } },
    select: { slug: true },
  });
  for (const p of products) {
    revalidatePath(`/products/${p.slug}`);
  }
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/dashboard");

  return NextResponse.json({ ok: true, status: nextStatus });
}
