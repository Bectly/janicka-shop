import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getComgatePaymentStatus } from "@/lib/payments/comgate";
import { ComgateError } from "@/lib/payments/types";
import { revalidatePath } from "next/cache";
import { sendPaymentConfirmedEmail } from "@/lib/email";

/**
 * Comgate webhook notification handler.
 * Comgate POSTs transId + status here when payment state changes.
 * CRITICAL: Never trust webhook payload alone — always verify via status API call.
 */
export async function POST(request: NextRequest) {
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

    // Find order by payment transaction ID
    const order = await prisma.order.findFirst({
      where: { paymentId: transId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      // Try finding by refId (order number) as fallback
      const orderByRef = await prisma.order.findUnique({
        where: { orderNumber: paymentStatus.refId },
        select: { id: true, status: true, orderNumber: true },
      });

      if (!orderByRef) {
        console.error(
          `[Comgate webhook] No order found for transId=${transId}, refId=${paymentStatus.refId}`,
        );
        // Return 200 so Comgate doesn't retry — order might have been deleted
        return NextResponse.json({ status: "order_not_found" });
      }

      // Update paymentId if not set yet
      await prisma.order.update({
        where: { id: orderByRef.id },
        data: { paymentId: transId },
      });

      await processPaymentStatus(orderByRef.id, orderByRef.status, paymentStatus.status);
    } else {
      await processPaymentStatus(order.id, order.status, paymentStatus.status);
    }

    // Revalidate relevant pages
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
  switch (comgateStatus) {
    case "PAID": {
      // Only mark as paid if order is still pending — never regress a more advanced status.
      // Use updateMany with status guard for atomic TOCTOU-safe write (same as payment-return page).
      if (currentOrderStatus === "pending") {
        const updated = await prisma.order.updateMany({
          where: { id: orderId, status: "pending" },
          data: { status: "paid" },
        });

        // Send payment confirmed email (fire-and-forget)
        if (updated.count > 0) {
          const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { customer: true },
          });
          if (order) {
            sendPaymentConfirmedEmail({
              orderNumber: order.orderNumber,
              customerName: `${order.customer.firstName} ${order.customer.lastName}`,
              customerEmail: order.customer.email,
              total: order.total,
              accessToken: order.accessToken ?? "",
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
        await prisma.$transaction(async (tx) => {
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
            where: { id: { in: productIds }, active: true },
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
    // PENDING — no action needed, order already in pending state
  }
}
