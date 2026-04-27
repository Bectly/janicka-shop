import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listR2Objects, deleteR2Object, buildR2Url } from "@/lib/r2";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { logger } from "@/lib/logger";

/**
 * Weekly orphan-cleanup for the J4 QR bulk-upload pipeline.
 *
 * Lists R2 objects under the `drafts/` prefix; for each object older than 7
 * days, deletes it iff the referencing ProductDraft has publishedProductId IS
 * NULL (or no ProductDraft references the key at all). Published drafts have
 * already had their objects copied to `products/` and removed from `drafts/`,
 * so a stale `drafts/` object is by definition orphaned — but we still gate on
 * publishedProductId to avoid racing an in-flight publish.
 */
export const GET = wrapCronRoute("cleanup-drafts", async () => {
  const db = await getDb();
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  let scanned = 0;
  let deleted = 0;
  let skippedRecent = 0;
  let skippedActive = 0;
  let failed = 0;

  try {
    const objects = await listR2Objects("drafts/");
    scanned = objects.length;

    for (const obj of objects) {
      const ageMs = obj.lastModified ? now - obj.lastModified.getTime() : Infinity;
      if (ageMs < SEVEN_DAYS_MS) {
        skippedRecent++;
        continue;
      }

      const url = buildR2Url(obj.key);
      const referencing = await db.productDraft.findFirst({
        where: {
          OR: [
            { images: { contains: url } },
            { defectImages: { contains: url } },
            { images: { contains: obj.key } },
            { defectImages: { contains: obj.key } },
          ],
        },
        select: { publishedProductId: true },
      });

      if (referencing && referencing.publishedProductId !== null) {
        skippedActive++;
        continue;
      }

      try {
        await deleteR2Object(obj.key);
        deleted++;
      } catch (err) {
        failed++;
        logger.warn(`[cron:cleanup-drafts] delete failed for ${obj.key}:`, err);
      }
    }
  } catch (error) {
    logger.error("[cron:cleanup-drafts] error:", error);
    return NextResponse.json(
      { error: "Internal error", scanned, deleted, failed },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    scanned,
    deleted,
    skippedRecent,
    skippedActive,
    failed,
  });
});
