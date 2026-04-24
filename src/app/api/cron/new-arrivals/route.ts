import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendNewArrivalEmail } from "@/lib/email";
import type { NewArrivalEmailData } from "@/lib/email";
import { getImageUrls } from "@/lib/images";
import { logger } from "@/lib/logger";

/**
 * New arrival notification email processor.
 * Finds products added in the last 24 hours and sends personalized emails
 * to newsletter subscribers whose preferences match.
 *
 * Designed to be called by Vercel Cron every 12 hours.
 * Protected by CRON_SECRET.
 *
 * Matching logic:
 * - Subscribers with preferences: products matching ANY of their preferred
 *   categories, sizes, or brands (union match — maximizes relevance).
 * - Subscribers without preferences: top 6 newest products.
 * - Only sends if there are matching products (no empty emails).
 * - Minimum 7-day gap between new-arrival emails per subscriber.
 *
 * Batch limit: 20 per run to stay within Resend rate limits.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let newProductCount = 0;

  try {
    // 1. Find new products from the last 24 hours
    const newProducts = await db.product.findMany({
      where: {
        active: true,
        sold: false,
        createdAt: { gte: twentyFourHoursAgo },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        compareAt: true,
        brand: true,
        condition: true,
        images: true,
        sizes: true,
        categoryId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Cap to prevent oversized queries
    });

    newProductCount = newProducts.length;

    if (newProducts.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, skipped: 0, failed: 0, reason: "no new products" });
    }

    // 2. Find active subscribers not emailed in last 7 days
    //    Skip paused subscribers (pausedUntil > now) and discount-only subscribers
    const subscribers = await db.newsletterSubscriber.findMany({
      where: {
        active: true,
        OR: [
          { lastNewArrivalEmailAt: null },
          { lastNewArrivalEmailAt: { lte: sevenDaysAgo } },
        ],
        // Exclude subscribers paused until a future date
        NOT: {
          pausedUntil: { gt: now },
        },
        // Exclude subscribers who only want discounts (not new arrivals)
        preferenceFilter: { not: "discounts" },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        preferredSizes: true,
        preferredCategories: true,
        preferredBrands: true,
      },
      take: 20,
      orderBy: { lastNewArrivalEmailAt: { sort: "asc", nulls: "first" } },
    });

    if (subscribers.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, skipped: 0, failed: 0, reason: "no eligible subscribers" });
    }

    // 3. Parse product data once
    const productData = newProducts.map((p) => {
      const images = getImageUrls(p.images);
      let sizes: string[] = [];
      try {
        sizes = JSON.parse(p.sizes) as string[];
      } catch { /* empty */ }

      return {
        ...p,
        image: images[0] ?? null,
        parsedSizes: sizes,
      };
    });

    // 4. For each subscriber, match products to preferences and send email
    for (const sub of subscribers) {
      let prefSizes: string[] = [];
      let prefCategories: string[] = [];
      let prefBrands: string[] = [];

      try { prefSizes = JSON.parse(sub.preferredSizes) as string[]; } catch { /* empty */ }
      try { prefCategories = JSON.parse(sub.preferredCategories) as string[]; } catch { /* empty */ }
      try { prefBrands = JSON.parse(sub.preferredBrands) as string[]; } catch { /* empty */ }

      const hasPreferences = prefSizes.length > 0 || prefCategories.length > 0 || prefBrands.length > 0;

      let matched: typeof productData;

      if (hasPreferences) {
        // Score products by how many preferences they match
        const scored = productData.map((p) => {
          let score = 0;

          // Category match
          if (prefCategories.length > 0 && prefCategories.includes(p.categoryId)) {
            score += 3;
          }

          // Size match (intersection of subscriber sizes with product sizes)
          if (prefSizes.length > 0 && p.parsedSizes.some((s) => prefSizes.includes(s))) {
            score += 2;
          }

          // Brand match (case-insensitive)
          if (prefBrands.length > 0 && p.brand) {
            const brandLower = p.brand.toLowerCase();
            if (prefBrands.some((b) => b.toLowerCase() === brandLower)) {
              score += 2;
            }
          }

          return { product: p, score };
        });

        // Only include products with at least one match
        matched = scored
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
          .map((s) => s.product);
      } else {
        // No preferences — send top 6 newest
        matched = productData.slice(0, 6);
      }

      // Skip if no matching products for this subscriber
      if (matched.length === 0) {
        skipped++;
        continue;
      }

      const emailData: NewArrivalEmailData = {
        email: sub.email,
        firstName: sub.firstName,
        products: matched.map((p) => ({
          name: p.name,
          slug: p.slug,
          price: p.price,
          compareAt: p.compareAt,
          brand: p.brand,
          condition: p.condition,
          image: p.image,
          sizes: p.parsedSizes,
        })),
      };

      const success = await sendNewArrivalEmail(emailData);

      if (success) {
        await db.newsletterSubscriber.update({
          where: { id: sub.id },
          data: { lastNewArrivalEmailAt: now },
        });
        sent++;
      } else {
        failed++;
      }
    }
  } catch (error) {
    logger.error("[Cron:new-arrivals] Error:", error);
    return NextResponse.json(
      { error: "Internal error", sent, skipped, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    failed,
    newProducts: newProductCount,
  });
}
