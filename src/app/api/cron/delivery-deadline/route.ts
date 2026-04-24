import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendAdminDeadlineAlertEmail, type DeadlineAlertOrder } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * Delivery deadline alert processor.
 * Checks for orders approaching or past their 30-day legal delivery deadline (§2159 NOZ).
 * Sends a summary email to admin with all urgent/overdue orders.
 * Designed to be called by Vercel Cron once daily.
 * Protected by CRON_SECRET.
 *
 * Alerts for orders where:
 * - status is NOT "delivered" or "cancelled"
 * - expectedDeliveryDate is within 5 days OR already past
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const now = new Date();
  const fiveDaysFromNow = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  try {
    // Find all active orders with deadline within 5 days or past
    const orders = await db.order.findMany({
      where: {
        status: { notIn: ["delivered", "cancelled"] },
        expectedDeliveryDate: {
          not: null,
          lte: fiveDaysFromNow,
        },
      },
      include: {
        customer: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { expectedDeliveryDate: "asc" },
    });

    if (orders.length === 0) {
      return NextResponse.json({ ok: true, alertsSent: 0, message: "No deadline alerts needed" });
    }

    const alertOrders: DeadlineAlertOrder[] = orders.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: `${o.customer.firstName} ${o.customer.lastName}`,
      total: o.total,
      daysRemaining: Math.ceil(
        (o.expectedDeliveryDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      ),
      expectedDeliveryDate: o.expectedDeliveryDate!,
      status: o.status,
    }));

    const sent = await sendAdminDeadlineAlertEmail(alertOrders);

    return NextResponse.json({
      ok: true,
      alertsSent: sent ? 1 : 0,
      ordersCount: alertOrders.length,
      overdue: alertOrders.filter((o) => o.daysRemaining < 0).length,
      urgent: alertOrders.filter((o) => o.daysRemaining >= 0 && o.daysRemaining <= 5).length,
    });
  } catch (error) {
    logger.error("[Cron:delivery-deadline] Error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
