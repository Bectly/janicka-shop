import { getDb } from "@/lib/db";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export interface CampaignLockResult {
  success: boolean;
  error?: string;
}

/**
 * Atomically claim a send lock for a campaign key. Backed by a unique DB row
 * so concurrent Vercel serverless invocations cannot both send — the second
 * caller hits the unique constraint and is rejected.
 *
 * The lock is self-expiring: a new claim succeeds once the prior lock's
 * expiresAt is in the past (stale lock is deleted first).
 */
export async function claimCampaignSendLock(
  campaignKey: string,
  windowMs: number = DEFAULT_WINDOW_MS,
): Promise<CampaignLockResult> {
  const db = await getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  await db.campaignSendLock.deleteMany({
    where: { campaignKey, expiresAt: { lt: now } },
  });

  try {
    await db.campaignSendLock.create({
      data: { campaignKey, claimedAt: now, expiresAt },
    });
    return { success: true };
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2002") {
      return {
        success: false,
        error:
          "Tato kampaň už byla odeslána (nebo právě běží) v posledních 60 minutách. Počkej před dalším odesláním.",
      };
    }
    throw err;
  }
}

/**
 * Release a lock early (e.g. after a failed send where the admin should be
 * allowed to retry immediately). Safe to call on a missing lock.
 */
export async function releaseCampaignSendLock(campaignKey: string): Promise<void> {
  const db = await getDb();
  await db.campaignSendLock.deleteMany({ where: { campaignKey } });
}
