import { getDb } from "@/lib/db";
import {
  sendMothersDayEmail,
  type CampaignProduct,
  type MothersDayEmailNumber,
  type MothersDaySegment,
} from "@/lib/email";
import { getImageUrls } from "@/lib/images";
import { claimCampaignSendLock, releaseCampaignSendLock } from "@/lib/campaign-lock";

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1100;
const FULL_SEND_WINDOW_MS = 60 * 60 * 1000;

export const MOTHERS_DAY_LABELS: Record<MothersDayEmailNumber, string> = {
  1: "Den matek #1 — Warmup (1. května)",
  2: "Den matek #2 — Push (7. května)",
  3: "Den matek #3 — Urgency (9. května)",
};

export interface MothersDayRunResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Core Mother's Day campaign dispatch — no auth, no rate-limit, no confirmation.
 * Caller (admin Server Action OR cron HTTP wrapper) is responsible for AuthN/Z.
 *
 * Lock-protected by `mothers-day:{n}` key (60-minute window) so two concurrent
 * runs (e.g. admin manual click + cron firing) cannot double-send.
 */
export async function runMothersDayCampaign(
  emailNumber: MothersDayEmailNumber,
): Promise<MothersDayRunResult> {
  const lockKey = `mothers-day:${emailNumber}`;
  const lock = await claimCampaignSendLock(lockKey, FULL_SEND_WINDOW_MS);
  if (!lock.success) {
    return { success: false, sentCount: 0, failedCount: 0, error: lock.error };
  }

  const db = await getDb();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const productCount = emailNumber === 3 ? 3 : emailNumber === 2 ? 6 : 4;
  const dbProducts = await db.product.findMany({
    where: { active: true, sold: false },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    select: {
      name: true,
      slug: true,
      price: true,
      compareAt: true,
      brand: true,
      condition: true,
      images: true,
    },
    take: productCount,
  });

  const products: CampaignProduct[] = dbProducts.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAt: p.compareAt,
    brand: p.brand,
    condition: p.condition,
    image: getImageUrls(p.images)[0] ?? null,
  }));

  const subscribers = await db.newsletterSubscriber.findMany({
    where: {
      active: true,
      OR: [{ pausedUntil: null }, { pausedUntil: { lt: now } }],
    },
    select: { email: true, createdAt: true },
  });

  if (subscribers.length === 0) {
    await releaseCampaignSendLock(lockKey);
    return { success: true, sentCount: 0, failedCount: 0 };
  }

  const campaign = await db.campaignLog.create({
    data: {
      subject: MOTHERS_DAY_LABELS[emailNumber],
      previewText: `Den matek email ${emailNumber}/3`,
      status: "sending",
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((sub) => {
        const segment: MothersDaySegment =
          emailNumber === 1
            ? sub.createdAt >= ninetyDaysAgo
              ? "warm"
              : "cold"
            : "warm";
        return sendMothersDayEmail(emailNumber, segment, products, sub.email);
      }),
    );
    for (const ok of results) {
      if (ok) sentCount++;
      else failedCount++;
    }
    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  await db.campaignLog.update({
    where: { id: campaign.id },
    data: { status: "completed", sentCount, failedCount },
  });

  return { success: true, sentCount, failedCount };
}
