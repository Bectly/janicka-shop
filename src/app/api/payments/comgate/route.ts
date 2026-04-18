import { NextRequest, NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";

import { getComgatePaymentStatus } from "@/lib/payments/comgate";
import { ComgateError } from "@/lib/payments/types";
import { revalidatePath } from "next/cache";
import { sendPaymentConfirmedEmail, sendAdminNewOrderEmail } from "@/lib/email";
import { dispatchEmail } from "@/lib/email-dispatch";
import { logOrderToHeureka } from "@/lib/heureka";

/**
 * Comgate webhook notification handler.
 * Comgate POSTs transId + status here when payment state changes.
 * CRITICAL: Never trust webhook payload alone — always verify via status API call.
 */
export async function POST(request: NextRequest) {
  await connection();
  let transId: string | null = null;

  try {
    // Comgate sends application/x-www-form-urlencoded
    const body = await request.text();
    const params = new URLSearchParams(body);
    transId = params.get("transId");

    if (!transId) {
      return NextResponse.json(
        { error: "Missing transId" },
        { status: 400 },
      );
    }

    // ALWAYS verify payment status via API — never trust webhook payload
    const paymentStatus = await getComgatePaymentStatus(transId);

    const db = await getDb();

    // Find order by payment transaction ID
    const order = await db.order.findFirst({
      where: { paymentId: transId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      // Try finding by refId (order number) as fallback
      const orderByRef = await db.order.findUnique({
        where: { orderNumber: paymentStatus.refId },
        select: { id: true, status: true, orderNumber: true },
      });

      if (!orderByRef) {
        console.error(
          `[Comgate webhook] No order found for transId=${transId}, refId=${paymentStatus.refId}`,
        );
        // Return 200 so Comgate doesn't retry — order might have been deleted
        return new NextResponse("code=0&message=OK", {
          status: 200,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      }

      // Update paymentId if not set yet
      await db.order.update({
        where: { id: orderByRef.id },
        data: { paymentId: transId },
      });

      await processPaymentStatus(orderByRef.id, orderByRef.status, paymentStatus.status);
    } else {
      await processPaymentStatus(order.id, order.status, paymentStatus.status);
    }

    // Revalidate ISR cache for affected product pages — with 3600s ISR,
    // stale sold/available status would persist for up to 1 hour without this.
    const revalidateOrder = order ?? (await db.order.findFirst({
      where: { paymentId: transId },
      select: { id: true },
    }));
    if (revalidateOrder) {
      const orderItems = await db.orderItem.findMany({
        where: { orderId: revalidateOrder.id },
        select: { productId: true },
      });
      const products = await db.product.findMany({
        where: { id: { in: orderItems.map((i) => i.productId) } },
        select: { slug: true },
      });
      for (const p of products) {
        revalidatePath(`/products/${p.slug}`);
      }
    }
    revalidatePath("/products");
    revalidatePath("/");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/dashboard");

    // Comgate expects HTTP 200 with "code=0&message=OK"
    return new NextResponse("code=0&message=OK", {
      status: 200,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch (error) {
    console.error(`[Comgate webhook] Error processing transId=${transId}:`, error);

    // ComgateError = permanent API error (bad transId, etc.) → return 200 so Comgate won't retry
    if (error instanceof ComgateError) {
      return new NextResponse("code=0&message=OK", {
        status: 200,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    }

    // Transient error (network timeout, DB down, etc.) → return 500 so Comgate retries
    return new NextResponse("code=1&message=TEMPORARY_ERROR", {
      status: 500,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  }
}

/**
 * Map Comgate payment status to order status update.
 * Only advances order status — never reverts a more advanced status.
 */
async function processPaymentStatus(
  orderId: string,
  currentOrderStatus: string,
  comgateStatus: string,
) {
  const db = await getDb();
  switch (comgateStatus) {
    case "PAID": {
      // Only mark as paid if order is still pending — never regress a more advanced status.
      // Use updateMany with status guard for atomic TOCTOU-safe write (same as payment-return page).
      if (currentOrderStatus === "pending") {
        const updated = await db.order.updateMany({
          where: { id: orderId, status: "pending" },
          data: { status: "paid" },
        });

        // Send payment confirmed email + log to Heureka (fire-and-forget)
        if (updated.count > 0) {
          const order = await db.order.findUnique({
            where: { id: orderId },
            include: { customer: true, items: { include: { product: { select: { sku: true } } } } },
          });
          if (order) {
            // P4.2: Enqueue customer + admin emails so the webhook returns fast
            // regardless of Resend latency or queue depth.
            dispatchEmail(
              "payment-confirmed",
              {
                orderNumber: order.orderNumber,
                customerName: `${order.customer.firstName} ${order.customer.lastName}`,
                customerEmail: order.customer.email,
                total: order.total,
                accessToken: order.accessToken ?? "",
              },
              sendPaymentConfirmedEmail,
            ).catch((err) => {
              console.error(`[Webhook] Payment confirmation dispatch failed for ${order.orderNumber}:`, err);
            });

            // Notify admin that a paid online order arrived (task #244)
            dispatchEmail(
              "admin-new-order",
              {
                orderNumber: order.orderNumber,
                orderId: order.id,
                customerName: `${order.customer.firstName} ${order.customer.lastName}`,
                customerEmail: order.customer.email,
                items: order.items.map((i) => ({
                  name: i.name,
                  price: i.price,
                  size: i.size,
                  color: i.color,
                })),
                total: order.total,
                paymentMethod: order.paymentMethod ?? "comgate",
                shippingMethod: order.shippingMethod ?? "",
                paid: true,
              },
              sendAdminNewOrderEmail,
            ).catch((err) => {
              console.error(`[Webhook] Admin notification dispatch failed for ${order.orderNumber}:`, err);
            });

            // Log to Heureka for "Ověřeno zákazníky" review questionnaire
            logOrderToHeureka(
              order.customer.email,
              order.orderNumber,
              order.items.map((i) => i.product.sku),
            ).catch((err) => {
              console.error(`[Webhook] Heureka ORDER_INFO failed for ${order.orderNumber}:`, err);
            });
          }
        }
      }
      break;
    }
    case "CANCELLED": {
      // Only cancel if order is still pending (hasn't been processed further).
      // Use updateMany with status guard for atomic TOCTOU-safe write,
      // consistent with the PAID branch above.
      if (currentOrderStatus === "pending") {
        await db.$transaction(async (tx) => {
          // Atomic status guard: only updates if still "pending"
          const updated = await tx.order.updateMany({
            where: { id: orderId, status: "pending" },
            data: { status: "cancelled" },
          });
          if (updated.count === 0) return; // Already advanced past pending

          // Release products back to catalog — only those still active
          // (soft-deleted products have active=false and should stay deleted)
          const items = await tx.orderItem.findMany({
            where: { orderId },
            select: { productId: true },
          });
          const productIds = items.map((i) => i.productId);
          await tx.product.updateMany({
            where: { id: { in: productIds }, active: true, sold: true },
            data: { sold: false, stock: 1 },
          });
        });
      }
      break;
    }
    case "AUTHORIZED": {
      // Card authorized but not captured — keep as pending, will become PAID
      break;
    }
    case "PENDING": {
      // No action needed, order already in pending state
      break;
    }
    default: {
      console.warn(
        `[Comgate webhook] Unknown payment status "${comgateStatus}" for order ${orderId}`,
      );
      break;
    }
  }
}
