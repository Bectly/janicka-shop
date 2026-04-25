import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendBrowseAbandonmentEmail } from "@/lib/email";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { logger } from "@/lib/logger";

/**
 * Browse abandonment email processor.
 * Runs every 30 minutes via Vercel Cron. Protected by CRON_SECRET.
 *
 * Logic:
 *   - Finds BrowseAbandonment records where:
 *     - status = "pending"
 *     - createdAt >= 4 hours ago (dwell period — user had time to return)
 *     - createdAt < 7 days ago (expire old records)
 *     - product is still available (not sold)
 *     - no other browse abandonment email sent to this email in past 7 days
 *     - product is NOT in any pending AbandonedCart for same email (avoid double emails)
 *   - Sends ONE email per record (no sequence — item may sell before email 2)
 *   - Sets sentAt + status = "sent"
 *   - Frequency cap: max 1 browse abandonment email per 7 days per email address
 *
 * Scout benchmark: €3.22 RPR.
 */
export const GET = wrapCronRoute("browse-abandonment", async () => {
  const db = await getDb();
  const now = new Date();

  // Time windows
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let expired = 0;
  let skipped = 0;

  try {
    // 1. Expire stale records (older than 7 days, still pending)
    const expiredResult = await db.browseAbandonment.updateMany({
      where: {
        status: "pending",
        createdAt: { lt: sevenDaysAgo },
      },
      data: { status: "sold" }, // treat as expired
    });
    expired = expiredResult.count;

    // 2. Mark records where product has been sold
    const pendingRecords = await db.browseAbandonment.findMany({
      where: {
        status: "pending",
        createdAt: { lt: fourHoursAgo, gt: sevenDaysAgo },
      },
      take: 100,
    });

    if (pendingRecords.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, expired, skipped: 0 });
    }

    // Check which products are still available
    const productIds = [...new Set(pendingRecords.map((r) => r.productId))];
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sold: true, active: true },
    });
    const unavailableIds = new Set(
      products.filter((p) => p.sold || !p.active).map((p) => p.id),
    );

    // Check which emails already have pending abandoned carts (avoid double emailing)
    const emails = [...new Set(pendingRecords.map((r) => r.email))];
    const activeCarts = await db.abandonedCart.findMany({
      where: {
        email: { in: emails },
        status: "pending",
      },
      select: { email: true },
    });
    const emailsWithActiveCarts = new Set(activeCarts.map((c) => c.email));

    // Check frequency cap: which emails received a browse abandonment email in past 7 days
    const recentlySent = await db.browseAbandonment.findMany({
      where: {
        email: { in: emails },
        status: "sent",
        sentAt: { gt: sevenDaysAgo },
      },
      select: { email: true },
    });
    const emailsRecentlySent = new Set(recentlySent.map((r) => r.email));

    // Track emails we send to in THIS run (enforce one per email per run)
    const sentThisRun = new Set<string>();

    for (const record of pendingRecords) {
      // Product sold/inactive → mark as sold
      if (unavailableIds.has(record.productId)) {
        await db.browseAbandonment.update({
          where: { id: record.id },
          data: { status: "sold" },
        });
        skipped++;
        continue;
      }

      // Email has active cart → skip (cart abandonment email takes priority)
      if (emailsWithActiveCarts.has(record.email)) {
        skipped++;
        continue;
      }

      // Frequency cap: already sent in past 7 days
      if (emailsRecentlySent.has(record.email)) {
        skipped++;
        continue;
      }

      // One email per address per cron run
      if (sentThisRun.has(record.email)) {
        skipped++;
        continue;
      }

      const success = await sendBrowseAbandonmentEmail({
        email: record.email,
        productName: record.productName,
        productSlug: record.productSlug,
        productImage: record.productImage,
        productPrice: record.productPrice,
        productBrand: record.productBrand,
        productSize: record.productSize,
      });

      if (success) {
        await db.browseAbandonment.update({
          where: { id: record.id },
          data: { sentAt: now, status: "sent" },
        });
        sentThisRun.add(record.email);
        emailsRecentlySent.add(record.email); // prevent sending to same email again
        sent++;
      }
    }

    return NextResponse.json({ ok: true, sent, expired, skipped });
  } catch (error) {
    logger.error("[Cron] Browse abandonment processing failed:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
});
