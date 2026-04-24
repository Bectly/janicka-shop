import { enqueueEmail, type EmailJobType } from "@/lib/queues";
import { logger } from "@/lib/logger";

/**
 * P4.2: Offload email sends from Server Actions onto BullMQ.
 *
 * Usage:
 *   dispatchEmail("order-confirmation", payload, sendOrderConfirmationEmail)
 *     .catch((e) => logger.error("[Checkout] Email dispatch failed:", e));
 *
 * Behaviour:
 *   - Production (REDIS_URL set): enqueues onto emailQueue — returns in ~5ms
 *     regardless of queue depth. Worker process picks up and sends via Resend.
 *   - Dev / preview (no REDIS_URL, or Redis down): falls back to inline send
 *     so nobody silently loses mail during local development.
 *
 * Never throws — both enqueue errors and inline-send errors are logged and
 * swallowed. Callers treat this as fire-and-forget.
 */
export async function dispatchEmail<T extends Record<string, unknown>>(
  type: EmailJobType,
  payload: T,
  inlineFallback: (p: T) => Promise<unknown>,
): Promise<void> {
  try {
    const queued = await enqueueEmail({ type, payload });
    if (queued) return;
  } catch (err) {
    logger.warn(
      `[email-dispatch] enqueue failed for type=${type}, falling back to inline send:`,
      err instanceof Error ? err.message : err,
    );
  }

  try {
    await inlineFallback(payload);
  } catch (err) {
    logger.error(
      `[email-dispatch] inline fallback failed for type=${type}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
