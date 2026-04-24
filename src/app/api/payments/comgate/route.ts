import { NextRequest, NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";

import { getComgatePaymentStatus } from "@/lib/payments/comgate";
import { ComgateError } from "@/lib/payments/types";
import { processPaymentStatus } from "@/lib/payments/process-status";
import { revalidatePath } from "next/cache";

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

      await processPaymentStatus(orderByRef.id, orderByRef.status, paymentStatus.status, "Comgate webhook");
    } else {
      await processPaymentStatus(order.id, order.status, paymentStatus.status, "Comgate webhook");
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

