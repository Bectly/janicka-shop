"use server";

import { getDb } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";

const trackSchema = z.object({
  email: z.string().trim().email().max(254),
  productId: z.string().min(1).max(100),
  productSlug: z.string().min(1).max(200),
  productName: z.string().min(1).max(500),
  productImage: z.string().max(2000).optional(),
  productPrice: z.number().positive(),
  productBrand: z.string().max(200).optional(),
  productSize: z.string().max(100).optional(),
});

/**
 * Track a product view for browse abandonment emails.
 * Called from PDP when:
 *   1. User has scrolled past hero (IntersectionObserver)
 *   2. Dwell time >= 5 seconds
 *   3. Email is known (from localStorage — prior checkout or newsletter signup)
 *   4. Product is NOT already in the user's cart
 *
 * Deduplicates: only one pending record per email + productId.
 * Frequency cap: skips if an email was already sent to this address in the past 7 days.
 */
export async function trackBrowseView(
  input: z.infer<typeof trackSchema>,
): Promise<{ tracked: boolean }> {
  const parsed = trackSchema.safeParse(input);
  if (!parsed.success) return { tracked: false };

  const data = parsed.data;
  const email = data.email.toLowerCase();

  try {
    const db = await getDb();

    // Frequency cap: skip if this email received a browse abandonment email in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentlySent = await db.browseAbandonment.findFirst({
      where: {
        email,
        status: "sent",
        sentAt: { gt: sevenDaysAgo },
      },
      select: { id: true },
    });
    if (recentlySent) return { tracked: false };

    // Dedup: don't create duplicate for same email + product
    const existing = await db.browseAbandonment.findFirst({
      where: {
        email,
        productId: data.productId,
        status: "pending",
      },
      select: { id: true },
    });
    if (existing) return { tracked: false };

    // Create browse abandonment record
    await db.browseAbandonment.create({
      data: {
        email,
        productId: data.productId,
        productSlug: data.productSlug,
        productName: data.productName,
        productImage: data.productImage ?? null,
        productPrice: data.productPrice,
        productBrand: data.productBrand ?? null,
        productSize: data.productSize ?? null,
      },
    });

    return { tracked: true };
  } catch (error) {
    logger.error("[BrowseAbandonment] Failed to track:", error);
    return { tracked: false };
  }
}
