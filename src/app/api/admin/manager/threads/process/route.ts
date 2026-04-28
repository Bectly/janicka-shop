import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { wrapCronRoute } from "@/lib/cron-metrics";
import {
  JANICKA_PROJECT_ID,
  processManagerThreadAnswer,
} from "@/lib/manager-thread";

/**
 * GET /api/admin/manager/threads/process — cron tick that picks the oldest
 * pending ManagerThread and runs the answer pipeline.
 *
 * Concurrency guard: skip if any thread is already in `processing` status.
 * This is a soft lock that holds for the duration of one cron invocation
 * (~30s); the watcher only ever runs one Anthropic call at a time.
 *
 * Auth: requireCronSecret (via wrapCronRoute) — Vercel Cron sends the secret.
 */
export const GET = wrapCronRoute("manager-threads-process", async () => {
  const db = await getDb();

  const inFlight = await db.managerThread.findFirst({
    where: { projectId: JANICKA_PROJECT_ID, status: "processing" },
    select: { id: true, updatedAt: true },
  });
  if (inFlight) {
    // If a thread has been "processing" for >5 minutes, treat it as a stuck
    // worker (Vercel function timeout) and reset to pending so we retry.
    const ageMs = Date.now() - inFlight.updatedAt.getTime();
    if (ageMs > 5 * 60 * 1000) {
      logger.warn(
        `[manager-threads-process] resetting stuck thread ${inFlight.id} (age ${ageMs}ms)`,
      );
      await db.managerThread.update({
        where: { id: inFlight.id },
        data: { status: "pending" },
      });
    } else {
      return NextResponse.json({ ok: true, skipped: "in-flight" });
    }
  }

  const pending = await db.managerThread.findFirst({
    where: { projectId: JANICKA_PROJECT_ID, status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!pending) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const result = await processManagerThreadAnswer(pending.id);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, threadId: pending.id, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    processed: 1,
    threadId: pending.id,
    messageId: result.messageId,
  });
});
