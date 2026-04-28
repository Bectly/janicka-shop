import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { sendBatchArchivedAdminEmail } from "@/lib/email";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { logger } from "@/lib/logger";

/**
 * J10-B3: auto-archive cron for stale draft batches.
 *
 * Finds ProductDraftBatch rows with status IN ('open','sealed') whose
 * `updatedAt` is older than 7 days, flips them to `archived`, and emails
 * the admin one notification per archived batch. Drafts are never deleted —
 * admin can still recover via /admin/drafts/[batchId].
 */
const STALE_DAYS = 7;

export const GET = wrapCronRoute("archive-stale-batches", async () => {
  const db = await getDb();
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const stale = await db.productDraftBatch.findMany({
    where: {
      status: { in: ["open", "sealed"] },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      lastActivityAt: true,
      bundle: { select: { invoiceNumber: true } },
      _count: { select: { drafts: true } },
    },
    take: 200,
  });

  let archived = 0;
  let notified = 0;
  let failed = 0;

  for (const batch of stale) {
    try {
      await db.productDraftBatch.update({
        where: { id: batch.id },
        data: { status: "archived", archivedAt: new Date() },
      });
      archived++;

      const label = batch.bundle?.invoiceNumber?.trim() || `#${batch.id.slice(-6).toUpperCase()}`;
      try {
        await sendBatchArchivedAdminEmail({
          batchId: batch.id,
          batchLabel: label,
          count: batch._count.drafts,
          lastActivityAt: batch.lastActivityAt,
        });
        notified++;
      } catch (err) {
        logger.warn(`[cron:archive-stale-batches] email failed for ${batch.id}:`, err);
      }
    } catch (err) {
      failed++;
      logger.error(`[cron:archive-stale-batches] archive failed for ${batch.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: stale.length,
    archived,
    notified,
    failed,
  });
});
