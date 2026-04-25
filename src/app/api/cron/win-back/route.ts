import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendWinBackEmail } from "@/lib/email";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { logger } from "@/lib/logger";

/**
 * Win-back email processor for lapsed customers.
 *
 * Targets customers whose LAST order is 30-90 days old.
 * Sends one win-back email per customer (tracked via Customer.winBackSentAt).
 *
 * Designed for Vercel Cron — runs once daily at 17:00 UTC (19:00 CET).
 * Protected by CRON_SECRET.
 *
 * Criteria:
 * - Customer has at least one paid/shipped/delivered order
 * - Most recent order is 30-90 days old
 * - winBackSentAt is NULL (haven't been emailed yet)
 * - Customer hasn't unsubscribed from marketing emails
 *
 * Batch limit: 10 per run to stay within Resend rate limits.
 */
export const GET = wrapCronRoute("win-back", async () => {
  const db = await getDb();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const unsubscribed = await db.newsletterSubscriber.findMany({
      where: { active: false },
      select: { email: true },
    });
    const unsubscribedEmails = new Set(unsubscribed.map((s) => s.email));

    const customers = await db.customer.findMany({
      where: {
        winBackSentAt: null,
        orders: {
          some: {
            status: { in: ["paid", "shipped", "delivered"] },
          },
        },
      },
      include: {
        orders: {
          where: { status: { in: ["paid", "shipped", "delivered"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      take: 20,
    });

    const eligible = customers.filter((c) => {
      const lastOrder = c.orders[0];
      if (!lastOrder) return false;
      return lastOrder.createdAt <= thirtyDaysAgo && lastOrder.createdAt >= ninetyDaysAgo;
    });

    for (const customer of eligible.slice(0, 10)) {
      if (unsubscribedEmails.has(customer.email)) {
        await db.customer.update({
          where: { id: customer.id },
          data: { winBackSentAt: now },
        });
        skipped++;
        continue;
      }

      const success = await sendWinBackEmail({
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerEmail: customer.email,
      });

      if (success) {
        await db.customer.update({
          where: { id: customer.id },
          data: { winBackSentAt: now },
        });
        sent++;
      } else {
        failed++;
      }
    }
  } catch (error) {
    logger.error("[Cron:win-back] Error:", error);
    return NextResponse.json(
      { error: "Internal error", sent, skipped, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
});
