import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendWinBackEmail } from "@/lib/email";
import { getImageUrls } from "@/lib/images";

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
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

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

    // Find customers who haven't received a win-back email yet
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
          select: {
            createdAt: true,
            items: {
              select: {
                productId: true,
                size: true,
                product: { select: { categoryId: true } },
              },
            },
          },
        },
      },
      take: 20, // fetch extra to account for skips
    });

    // Filter to customers whose latest order is 30-90 days old
    const eligible = customers.filter((c) => {
      const lastOrder = c.orders[0];
      if (!lastOrder) return false;
      return lastOrder.createdAt <= thirtyDaysAgo && lastOrder.createdAt >= ninetyDaysAgo;
    });

    for (const customer of eligible.slice(0, 10)) {
      // Skip unsubscribed customers
      if (unsubscribedEmails.has(customer.email)) {
        await db.customer.update({
          where: { id: customer.id },
          data: { winBackSentAt: now },
        });
        skipped++;
        continue;
      }

      const lastOrder = customer.orders[0];
      // Gather categories and sizes from last order for recommendations
      const categoryIds = [...new Set(lastOrder.items.map((i) => i.product.categoryId))];
      const orderedSizes = [...new Set(lastOrder.items.filter((i) => i.size).map((i) => i.size!))];
      const orderedProductIds = lastOrder.items.map((i) => i.productId);

      // Fetch fresh products from same categories — prefer size matches
      const candidates = await db.product.findMany({
        where: {
          ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
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

      // Score by size match
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
        await db.customer.update({
          where: { id: customer.id },
          data: { winBackSentAt: now },
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

      const success = await sendWinBackEmail({
        customerName: `${customer.firstName} ${customer.lastName}`,
        customerEmail: customer.email,
        products,
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
    console.error("[Cron:win-back] Error:", error);
    return NextResponse.json(
      { error: "Internal error", sent, skipped, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}
