import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * Cron observability wrapper (#557). Wraps requireCronSecret-gated routes with
 * start/end timers + try/catch error counters, and posts custom events
 * (cron_duration_ms, cron_error) to the GA4 Measurement Protocol so silent
 * cron failures (post-#499 timing-safe migration) become visible in analytics.
 *
 * Auth contract: the wrapper runs requireCronSecret BEFORE timing/dispatch, so
 * unauthorized requests never get measured (no metrics-side oracle for the
 * secret) and never trigger an outbound HTTP call.
 *
 * Zero-impact on success path:
 *   - GA4 dispatch is gated on both NEXT_PUBLIC_GA4_MEASUREMENT_ID and
 *     GA4_API_SECRET being set; otherwise it is a no-op.
 *   - The dispatch is awaited with a 1500ms abort timeout so a slow GA4
 *     endpoint cannot extend the cron's response time materially.
 *   - All dispatch failures are swallowed (logged at warn) so observability
 *     can never take down the underlying cron.
 *
 * Idempotency: the wrapper has no DB writes; running the same wrapped handler
 * twice is exactly as idempotent as the underlying handler.
 */

const GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA4_TIMEOUT_MS = 1500;
const GA4_CLIENT_ID = "cron-server";

async function postGA4Event(
  eventName: "cron_duration_ms" | "cron_error",
  params: Record<string, string | number>,
): Promise<void> {
  const measurementId =
    process.env.NEXT_PUBLIC_GA4_ID ?? process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  const url = `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(
    measurementId,
  )}&api_secret=${encodeURIComponent(apiSecret)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GA4_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GA4_CLIENT_ID,
        non_personalized_ads: true,
        events: [{ name: eventName, params }],
      }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    // Observability must never take down the cron — log and move on.
    logger.warn(`[cron-metrics] GA4 dispatch failed for ${eventName}:`, err);
  } finally {
    clearTimeout(timeout);
  }
}

export type CronHandler = (request: Request) => Promise<NextResponse>;

/**
 * Wrap a cron route handler with auth + GA4 timing/error metrics.
 *
 * Migration pattern:
 *   // before
 *   export async function GET(request: Request) {
 *     const unauthorized = requireCronSecret(request);
 *     if (unauthorized) return unauthorized;
 *     // ...body
 *   }
 *
 *   // after
 *   export const GET = wrapCronRoute("back-in-stock-notify", async (request) => {
 *     // ...body (no requireCronSecret call needed — wrapper handles it)
 *   });
 */
export function wrapCronRoute(name: string, handler: CronHandler): CronHandler {
  return async (request: Request) => {
    const unauthorized = requireCronSecret(request);
    if (unauthorized) return unauthorized;

    const start = Date.now();
    try {
      const response = await handler(request);
      const durationMs = Date.now() - start;
      await postGA4Event("cron_duration_ms", {
        cron_name: name,
        duration_ms: durationMs,
        status_code: response.status,
        outcome: response.ok ? "ok" : "handler_error_response",
      });
      return response;
    } catch (error) {
      const durationMs = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[cron-metrics] ${name} threw after ${durationMs}ms:`, error);
      await postGA4Event("cron_error", {
        cron_name: name,
        duration_ms: durationMs,
        error_message: message.slice(0, 200),
      });
      return NextResponse.json(
        { error: "Internal error" },
        { status: 500 },
      );
    }
  };
}
