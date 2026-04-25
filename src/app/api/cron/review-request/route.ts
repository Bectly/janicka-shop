import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendReviewRequestEmail } from "@/lib/email";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { logger } from "@/lib/logger";

/**
 * Review request email processor.
 * Sends "How was your purchase?" emails 7 days after order was shipped.
 * Designed to be called by Vercel Cron every 6 hours.
 * Protected by CRON_SECRET.
 *
 * Only sends to orders where:
 * - status is "shipped" or "delivered"
 * - shippedAt is 7+ days ago
 * - reviewEmailSentAt is NULL (not yet sent)
 *
 * Batch limit: 10 per run to stay within Resend rate limits.
 */
export const GET = wrapCronRoute("review-request", async () => {
  const db = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let failed = 0;

  try {
    // Find orders shipped 7+ days ago that haven't received a review email
    const orders = await db.order.findMany({
      where: {
        status: { in: ["shipped", "delivered"] },
        shippedAt: { not: null, lte: sevenDaysAgo },
        reviewEmailSentAt: null,
      },
      include: {
        customer: {
          select: { firstName: true, lastName: true, email: true },
        },
        items: {
          select: {
            name: true,
            size: true,
            color: true,
            product: { select: { slug: true, images: true } },
          },
        },
      },
      take: 10,
      orderBy: { shippedAt: "asc" },
    });

    for (const order of orders) {
      const success = await sendReviewRequestEmail({
        orderNumber: order.orderNumber,
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        customerEmail: order.customer.email,
        accessToken: order.accessToken ?? "",
        items: order.items.map((i) => {
          let firstImage: string | null = null;
          try {
            const imgs: string[] = JSON.parse(i.product?.images ?? "[]");
            firstImage = imgs[0] ?? null;
          } catch {
            firstImage = null;
          }
          return {
            name: i.name,
            size: i.size,
            color: i.color,
            slug: i.product?.slug ?? null,
            image: firstImage,
          };
        }),
      });

      if (success) {
        // Mark as sent to prevent duplicate emails
        await db.order.update({
          where: { id: order.id },
          data: { reviewEmailSentAt: now },
        });
        sent++;
      } else {
        failed++;
      }
    }
  } catch (error) {
    logger.error("[Cron:review-request] Error:", error);
    return NextResponse.json(
      { error: "Internal error", sent, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent, failed });
});
