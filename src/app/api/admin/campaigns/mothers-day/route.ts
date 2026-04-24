import { NextResponse } from "next/server";
import { runMothersDayCampaign } from "@/lib/campaigns/mothers-day";
import type { MothersDayEmailNumber } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * Cron HTTP wrapper for the Mother's Day 3-email campaign.
 *
 * Auth: Bearer CRON_SECRET (matches scripts/cron/newsletter-dispatch.ts pattern).
 * Body: { "emailNumber": 1 | 2 | 3 }
 *
 * Idempotency: runMothersDayCampaign() claims a 60-min CampaignSendLock per
 * email number. The cron dispatcher additionally writes a 365-day lock keyed
 * by campaign entry — together they make repeat triggers safe.
 *
 * Schedule (May 2026):
 *   #1 Warmup  — 2026-05-01 09:00 CET
 *   #2 Push    — 2026-05-07 09:00 CET
 *   #3 Urgency — 2026-05-09 09:00 CET
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Expected { emailNumber: 1 | 2 | 3 }." },
      { status: 400 },
    );
  }

  const raw = (payload as { emailNumber?: unknown } | null)?.emailNumber;
  if (raw !== 1 && raw !== 2 && raw !== 3) {
    return NextResponse.json(
      { error: "emailNumber must be 1, 2, or 3." },
      { status: 400 },
    );
  }
  const emailNumber = raw as MothersDayEmailNumber;

  try {
    const result = await runMothersDayCampaign(emailNumber);
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.error, sentCount: 0, failedCount: 0 },
        { status: 409 },
      );
    }
    return NextResponse.json({
      ok: true,
      emailNumber,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    });
  } catch (error) {
    logger.error(`[api/admin/campaigns/mothers-day] #${emailNumber} crashed:`, error);
    return NextResponse.json(
      { ok: false, error: "Internal error during campaign dispatch." },
      { status: 500 },
    );
  }
}
