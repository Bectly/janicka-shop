/**
 * Heureka.cz ORDER_INFO v2 integration — "Ověřeno zákazníky" (Shop Certification).
 *
 * After a customer pays, we log the order to Heureka so they can send
 * a review questionnaire. This is required for Heureka certification.
 *
 * API: POST https://api.heureka.cz/shop-certification/v2/order/log
 * Docs: https://sluzby.heureka.cz/napoveda/overeno-zakazniky/
 */

import { logger } from "@/lib/logger";

const HEUREKA_ORDER_LOG_URL =
  "https://api.heureka.cz/shop-certification/v2/order/log";

/**
 * Log a completed order to Heureka for review questionnaire dispatch.
 *
 * Skips silently if HEUREKA_API_KEY is not set (graceful degradation
 * for dev/staging environments or before Heureka registration).
 *
 * @param email - Customer email (Heureka sends questionnaire here)
 * @param orderId - Order identifier (our orderNumber)
 * @param productItemIds - Product SKUs matching the Heureka XML feed ITEM_ID values
 */
export async function logOrderToHeureka(
  email: string,
  orderId: string,
  productItemIds: string[],
): Promise<void> {
  const apiKey = process.env.HEUREKA_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(HEUREKA_ORDER_LOG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        email,
        orderId,
        productItemIds,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error(
        `[Heureka] ORDER_INFO failed: ${res.status} ${res.statusText} — ${text}`,
      );
    }
  } catch (err) {
    // Network error — log and move on, never block order flow
    logger.error("[Heureka] ORDER_INFO request failed:", err);
  }
}
