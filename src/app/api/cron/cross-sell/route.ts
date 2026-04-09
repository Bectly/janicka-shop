import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendCrossSellFollowUpEmail } from "@/lib/email";
import { getImageUrls } from "@/lib/images";

/**
 * Cross-sell follow-up email processor (T+14 days after order creation).
 * Sends "Nové kousky ve tvém stylu" with 3 live products from the same
 * category + size as the customer's purchased items.
 *
 * Designed to be called by Vercel Cron once daily at 17:00 UTC (19:00 CET).
 * Protected by CRON_SECRET.
 *
 * Only sends to orders where:
 * - status is "paid" or "shipped" or "delivered"
 * - createdAt is 14+ days ago
 * - createdAt is less than 30 days ago (don't spam old orders)
 * - crossSellEmailSentAt is NULL (not yet sent)
 * - customer has NOT placed another order since (no re-engagement needed)
 *
 * Batch limit: 10 per run to stay within Resend rate limits.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // Fetch emails that have explicitly opted out of all marketing
    const unsubscribed = await db.newsletterSubscriber.findMany({
      where: { active: false },
      select: { email: true },
    });
    const unsubscribedEmails = new Set(unsubscribed.map((s) => s.email));

    // Find eligible orders: paid/shipped/delivered, 14-30 days old, no cross-sell sent
    const orders = await db.order.findMany({
      where: {
        status: { in: ["paid", "shipped", "delivered"] },
        createdAt: {
          lte: fourteenDaysAgo,
          gte: thirtyDaysAgo,
        },
        crossSellEmailSentAt: null,
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        items: {
          select: {
            productId: true,
            size: true,
            product: { select: { categoryId: true, sizes: true } },
          },
        },
      },
      take: 10,
      orderBy: { createdAt: "asc" },
    });

    for (const order of orders) {
      // Skip if customer has explicitly unsubscribed from all marketing emails
      if (unsubscribedEmails.has(order.customer.email)) {
        await db.order.update({
          where: { id: order.id },
          data: { crossSellEmailSentAt: now },
        });
        skipped++;
        continue;
      }

      // Skip if customer has placed another order since this one
      const laterOrder = await db.order.findFirst({
        where: {
          customerId: order.customer.id,
          createdAt: { gt: order.createdAt },
          status: { in: ["paid", "shipped", "delivered"] },
        },
        select: { id: true },
      });

      if (laterOrder) {
        // Customer already re-engaged — mark as sent to skip in future
        await db.order.update({
          where: { id: order.id },
          data: { crossSellEmailSentAt: now },
        });
        skipped++;
        continue;
      }

      // Gather categories and sizes from ordered items
      const categoryIds = [...new Set(order.items.map((i) => i.product.categoryId))];
      const orderedSizes = [
        ...new Set(order.items.filter((i) => i.size).map((i) => i.size!)),
      ];
      const orderedProductIds = order.items.map((i) => i.productId);

      // Fetch candidates from same categories, live inventory only
      const candidates = await db.product.findMany({
        where: {
          categoryId: { in: categoryIds },
          id: { notIn: orderedProductIds },
          active: true,
          sold: false,
        },
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          name: true,
          slug: true,
          price: true,
          compareAt: true,
          brand: true,
          condition: true,
          images: true,
          sizes: true,
        },
      });

      // Score: size match first, then newest
      const scored = candidates.map((p) => {
        let parsedSizes: string[] = [];
        try { parsedSizes = JSON.parse(p.sizes) as string[]; } catch { /* empty */ }
        const sizeMatch =
          orderedSizes.length > 0 && parsedSizes.some((s) => orderedSizes.includes(s));
        return { ...p, sizeMatch, parsedSizes };
      });

      const sizeMatched = scored.filter((p) => p.sizeMatch);
      const rest = scored.filter((p) => !p.sizeMatch);
      const selected = [...sizeMatched, ...rest].slice(0, 3);

      // Skip if no products to recommend
      if (selected.length === 0) {
        await db.order.update({
          where: { id: order.id },
          data: { crossSellEmailSentAt: now },
        });
        skipped++;
        continue;
      }

      const products = selected.map((p) => {
        const images = getImageUrls(p.images);
        return {
          name: p.name,
          slug: p.slug,
          price: p.price,
          compareAt: p.compareAt,
          brand: p.brand,
          condition: p.condition,
          image: images[0] ?? null,
          sizes: p.parsedSizes,
        };
      });

      const success = await sendCrossSellFollowUpEmail({
        customerName: `${order.customer.firstName} ${order.customer.lastName}`,
        customerEmail: order.customer.email,
        orderNumber: order.orderNumber,
        products,
      });

      if (success) {
        await db.order.update({
          where: { id: order.id },
          data: { crossSellEmailSentAt: now },
        });
        sent++;
      } else {
        failed++;
      }
    }
  } catch (error) {
    console.error("[Cron:cross-sell] Error:", error);
    return NextResponse.json(
      { error: "Internal error", sent, skipped, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}
