"use server";

import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Re-subscribe a previously unsubscribed email with an optional preference filter.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 */
export async function updateNewsletterPreference(
  email: string,
  action: "resubscribe" | "new_arrivals" | "discounts" | "pause_30",
): Promise<{ ok: boolean; error?: string }> {
  if (!email || !email.includes("@") || email.length > 255) {
    return { ok: false, error: "Neplatný e-mail." };
  }

  try {
    const db = await getDb();
    const subscriber = await db.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (!subscriber) {
      return { ok: false, error: "Odběratel nenalezen." };
    }

    if (action === "resubscribe") {
      await db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { active: true, preferenceFilter: null, pausedUntil: null },
      });
    } else if (action === "new_arrivals") {
      await db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { active: true, preferenceFilter: "new_arrivals", pausedUntil: null },
      });
    } else if (action === "discounts") {
      await db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { active: true, preferenceFilter: "discounts", pausedUntil: null },
      });
    } else if (action === "pause_30") {
      const pauseEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { active: true, preferenceFilter: null, pausedUntil: pauseEnd },
      });
    }

    return { ok: true };
  } catch (error) {
    logger.error("[Newsletter] Preference update failed for", email, error);
    return { ok: false, error: "Něco se nepovedlo." };
  }
}
