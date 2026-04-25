import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export type EmailDedupEventType =
  | "back-in-stock"
  | "wishlist-sold"
  | "similar-item-arrived";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Cross-pipeline notify dedup gate (#556).
 *
 * Three independent pipelines can each fire for the same (email, productId)
 * within the same product event:
 *   - BackInStockSubscription cron (back-in-stock)
 *   - WishlistSubscription on checkout (wishlist-sold)
 *   - ProductNotifyRequest similar-item cron (similar-item-arrived)
 *
 * Without this gate the recipient gets 2-3 near-identical emails in a couple
 * of hours, which burns trust and risks spam-flagging.
 *
 * Returns true if the dispatch should proceed (and records the row), false if
 * a prior dispatch for the same (email, productId) is within the 24h window
 * OR the unique-constraint race was lost. Never throws — failures degrade to
 * "skip" so a broken dedup table can't take down the email pipeline.
 *
 * The unique constraint on (email, productId, eventType) doubles as an
 * idempotency guard — re-running the same cron pass cannot double-send for
 * the same target.
 */
export async function checkAndRecordEmailDispatch(
  email: string,
  productId: string,
  eventType: EmailDedupEventType,
): Promise<boolean> {
  let db;
  try {
    db = await getDb();
  } catch (err) {
    logger.error("[email-dedup] db unavailable, allowing send:", err);
    return true;
  }

  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);

  try {
    const recent = await db.emailDedupLog.findFirst({
      where: { email, productId, sentAt: { gte: cutoff } },
      select: { eventType: true },
    });

    if (recent) {
      logger.info(
        `[email-dedup] skip ${eventType} for ${email}/${productId} — recent ${recent.eventType} within 24h`,
      );
      return false;
    }
  } catch (err) {
    logger.error("[email-dedup] lookup failed, allowing send:", err);
    return true;
  }

  try {
    await db.emailDedupLog.create({
      data: { email, productId, eventType, sentAt: new Date() },
    });
    return true;
  } catch {
    // Unique violation on (email, productId, eventType) — concurrent fire beat
    // us, or this exact tuple already exists from a prior run. Either way: skip.
    logger.info(
      `[email-dedup] skip ${eventType} for ${email}/${productId} — dispatch row already exists`,
    );
    return false;
  }
}
