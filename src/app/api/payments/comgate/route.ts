import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getComgatePaymentStatus } from "@/lib/payments/comgate";
import { revalidatePath } from "next/cache";

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
    // Return 200 to prevent infinite retries on permanent errors
    // Log for manual investigation
    return new NextResponse("code=0&message=OK", {
      status: 200,
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
      // Only mark as paid if order is still pending or confirmed
      if (currentOrderStatus === "pending" || currentOrderStatus === "confirmed") {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: "paid",
            paymentMethod: "comgate",
          },
        });
      }
      break;
    }
    case "CANCELLED": {
      // Only cancel if order is still pending (hasn't been processed further)
      if (currentOrderStatus === "pending") {
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: orderId },
            select: { items: { select: { productId: true } } },
          });
          if (!order) return;

          // Release products back to catalog — only those still active
          // (soft-deleted products have active=false and should stay deleted)
          const productIds = order.items.map((i) => i.productId);
          await tx.product.updateMany({
            where: { id: { in: productIds }, active: true },
            data: { sold: false, stock: 1 },
          });

          await tx.order.update({
            where: { id: orderId },
            data: { status: "cancelled", paymentMethod: "comgate" },
          });
        });
      }
      break;
    }
    case "AUTHORIZED": {
      // Card authorized but not captured — keep as pending, will become PAID
      if (currentOrderStatus === "pending") {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentMethod: "comgate" },
        });
      }
      break;
    }
    // PENDING — no action needed, order already in pending state
  }
}
