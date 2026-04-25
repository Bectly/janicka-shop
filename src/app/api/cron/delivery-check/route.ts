import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendDeliveryCheckEmail } from "@/lib/email";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { logger } from "@/lib/logger";

/**
 * Delivery check-in email processor.
 * Sends "Dorazilo vše v pořádku?" emails 4 days after order was shipped.
 * Pure care email — no marketing, no cross-sell. Reduces chargebacks, builds trust.
 * Designed to be called by Vercel Cron every 6 hours.
 * Protected by CRON_SECRET.
 *
 * Only sends to orders where:
 * - status is "shipped" or "delivered"
 * - shippedAt is 4+ days ago
 * - deliveryCheckEmailSentAt is NULL (not yet sent)
 * - shippedAt is less than 14 days ago (don't send for very old orders)
 *
 * Batch limit: 20 per run to stay within Resend rate limits.
 */
export const GET = wrapCronRoute("delivery-check", async () => {
  const db = await getDb();
  const now = new Date();
  const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let failed = 0;

  try {
    // Find orders shipped 4+ days ago (but <14 days) that haven't received a delivery check email
    const orders = await db.order.findMany({
      where: {
        status: { in: ["shipped", "delivered"] },
        shippedAt: {
          not: null,
          lte: fourDaysAgo,
          gte: fourteenDaysAgo,
        },
        deliveryCheckEmailSentAt: null,
      },
      include: {
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
        items: {
          select: { name: true, size: true, color: true },
        },
      },
      take: 20,
      orderBy: { shippedAt: "asc" },
    });

    for (const order of orders) {
      const success = await sendDeliveryCheckEmail({
        orderNumber: order.orderNumber,
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        customerEmail: order.customer.email,
        accessToken: order.accessToken ?? "",
        items: order.items.map((i) => ({
          name: i.name,
          size: i.size,
          color: i.color,
        })),
      });

      if (success) {
        await db.order.update({
          where: { id: order.id },
          data: { deliveryCheckEmailSentAt: now },
        });
        sent++;
      } else {
        failed++;
      }
    }
  } catch (error) {
    logger.error("[Cron:delivery-check] Error:", error);
    return NextResponse.json(
      { error: "Internal error", sent, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent, failed });
});
