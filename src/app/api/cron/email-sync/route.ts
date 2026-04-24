import { NextResponse } from "next/server";
import { syncImapInbox } from "@/lib/email/imap-sync";
import { requireCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * IMAP inbox sync cron. Scheduled in vercel.json every 5 min.
 * Protected by CRON_SECRET. Returns early if IMAP_* env vars are not provisioned.
 *
 * Task #496 — admin mailbox inbound pipeline (Phase 1).
 */
export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  try {
    const result = await syncImapInbox();
    if (!result.ok) {
      logger.warn("[Cron:email-sync] skipped or failed", result);
      return NextResponse.json(result, { status: result.error === "imap_disabled" ? 200 : 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    logger.error("[Cron:email-sync] unhandled error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
