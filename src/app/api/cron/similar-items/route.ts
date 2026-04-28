import { NextResponse } from "next/server";
import { getMailer } from "@/lib/email/resend-transport";
import { FROM_NEWSLETTER, REPLY_TO } from "@/lib/email/addresses";
import { getDb } from "@/lib/db";
import { buildSimilarItemsArrivedHtml } from "@/lib/email/similar-item";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { checkAndRecordEmailDispatch } from "@/lib/email-dedup";
import { logger } from "@/lib/logger";

/**
 * Similar items arrived cron — processes ProductNotifyRequest records.
 *
 * Every 2 hours, finds unnotified requests and checks for matching
 * new products (same category, size overlap, added in last 48h).
 * Sends personalized email with up to 3 matching products.
 *
 * Protected by CRON_SECRET (Vercel cron authentication).
 * Batch limit: 30 requests per run.
 */
export const GET = wrapCronRoute("similar-items", async () => {
  const mailer = getMailer();
  if (!mailer) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      reason: "RESEND_API_KEY not set",
    });
  }

  const db = await getDb();
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // 1. Find all unnotified requests (batch limit to avoid timeout)
    const requests = await db.productNotifyRequest.findMany({
      where: { notified: false },
      take: 30,
      orderBy: { createdAt: "asc" },
    });

    if (requests.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        skipped: 0,
        failed: 0,
        reason: "no pending requests",
      });
    }

    // 2. Process each request
    for (const req of requests) {
      try {
        // Parse request sizes
        let reqSizes: string[] = [];
        try {
          reqSizes = JSON.parse(req.sizes) as string[];
        } catch {
          /* corrupted JSON — will match any size */
        }

        // Query new products in same category from last 48h
        const products = await db.product.findMany({
          where: {
            categoryId: req.categoryId,
            active: true,
            sold: false,
            createdAt: { gte: fortyEightHoursAgo },
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
          },
          orderBy: { createdAt: "desc" },
          take: 10, // fetch extra for filtering
        });

        if (products.length === 0) {
          skipped++;
          continue;
        }

        // Filter by size overlap
        const sizeMatched = products.filter((p) => {
          if (reqSizes.length === 0) return true; // no size preference = match all
          try {
            const productSizes: string[] = JSON.parse(p.sizes);
            if (productSizes.length === 0) return true; // product has no sizes listed = include
            return reqSizes.some((s) => productSizes.includes(s));
          } catch {
            return true; // corrupted JSON = include
          }
        });

        if (sizeMatched.length === 0) {
          skipped++;
          continue;
        }

        // Prefer brand-matching products if request has brand preference
        let finalProducts = sizeMatched;
        if (req.brand) {
          const brandLower = req.brand.toLowerCase();
          const brandMatched = sizeMatched.filter(
            (p) => p.brand?.toLowerCase() === brandLower,
          );
          // Use brand matches if we have any, otherwise fall back to all size matches
          if (brandMatched.length > 0) {
            finalProducts = brandMatched;
          }
        }

        // Take max 3
        const topProducts = finalProducts.slice(0, 3);

        // 3. Cross-pipeline dedup gate (#556) — keyed on the lead match.
        const allowed = await checkAndRecordEmailDispatch(
          req.email,
          topProducts[0].id,
          "similar-item-arrived",
        );
        if (!allowed) {
          await db.productNotifyRequest.update({
            where: { id: req.id },
            data: { notified: true },
          });
          skipped++;
          continue;
        }

        // 4. Send email
        await mailer.sendMail({
          from: FROM_NEWSLETTER,
          replyTo: REPLY_TO,
          to: req.email,
          subject: "Právě přidáno: kousky, které by se ti mohly líbit",
          html: buildSimilarItemsArrivedHtml(topProducts, req.email),
        });

        // 5. Mark notified
        await db.productNotifyRequest.update({
          where: { id: req.id },
          data: { notified: true },
        });

        sent++;
      } catch (err) {
        logger.error(
          `[Cron:similar-items] Failed for request ${req.id} (${req.email}):`,
          err,
        );
        failed++;
      }
    }
  } catch (error) {
    logger.error("[Cron:similar-items] Error:", error);
    return NextResponse.json(
      { error: "Internal error", sent, skipped, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
});
