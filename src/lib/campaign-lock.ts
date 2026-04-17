import { getDb } from "@/lib/db";

const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

export interface CampaignLockResult {
  success: boolean;
  error?: string;
}

/**
 * Segment overlap matrix. Two campaign keys conflict when their recipient sets
 * intersect — sending one while the other is locked risks double-delivery to
 * the overlapping subscribers. Currently only Vinted segments overlap:
 *   vinted:all ⊇ vinted:warm ∪ vinted:cold   (warm and cold are disjoint)
 * Mothers-day and customs keys are per-email-number and never overlap, so
 * they simply return [].
 */
export function getConflictingCampaignKeys(campaignKey: string): string[] {
  switch (campaignKey) {
    case "vinted:all":
      return ["vinted:warm", "vinted:cold"];
    case "vinted:warm":
    case "vinted:cold":
      return ["vinted:all"];
    default:
      return [];
  }
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

  const conflictingKeys = getConflictingCampaignKeys(campaignKey);
  const keysToSweep = [campaignKey, ...conflictingKeys];
  await db.campaignSendLock.deleteMany({
    where: { campaignKey: { in: keysToSweep }, expiresAt: { lt: now } },
  });

  if (conflictingKeys.length > 0) {
    const conflict = await db.campaignSendLock.findFirst({
      where: { campaignKey: { in: conflictingKeys }, expiresAt: { gt: now } },
      select: { campaignKey: true },
    });
    if (conflict) {
      return {
        success: false,
        error: `Překrývající se kampaň "${conflict.campaignKey}" právě běží nebo byla odeslána v posledních 60 minutách. Hrozí dvojité odeslání stejným odběratelům — počkej.`,
      };
    }
  }

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
