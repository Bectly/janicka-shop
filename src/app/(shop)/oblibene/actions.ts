"use server";

import { getDb } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  images: string;
  brand: string | null;
  condition: string;
  categoryName: string;
  sold: boolean;
}

export async function getWishlistProducts(
  productIds: string[]
): Promise<WishlistProduct[]> {
  if (productIds.length === 0) return [];

  // Cap input to prevent oversized IN queries from malicious clients
  const ids = productIds.slice(0, 100);

  const db = await getDb();
  const products = await db.product.findMany({
    where: { id: { in: ids }, active: true },
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAt: p.compareAt,
    images: p.images,
    brand: p.brand,
    condition: p.condition,
    categoryName: p.category.name,
    sold: p.sold,
  }));
}

const subscribeSchema = z.object({
  email: z.string().email().max(254),
  productIds: z.array(z.string().max(128)).min(1).max(100),
});

/**
 * Persist wishlist email subscriptions so we can email the user if any of
 * their wishlisted products sells (Once Again pattern). One row per
 * (email, productId) — dedup via upsert on the compound unique index.
 * Only subscribes to products currently available (not already sold).
 */
export async function subscribeWishlistNotifications(input: {
  email: string;
  productIds: string[];
}): Promise<{ ok: boolean; count: number }> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, count: 0 };

  const { email, productIds } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const db = await getDb();

    const availableIds = (
      await db.product.findMany({
        where: { id: { in: productIds }, active: true, sold: false },
        select: { id: true },
      })
    ).map((p) => p.id);

    if (availableIds.length === 0) return { ok: true, count: 0 };

    let count = 0;
    for (const productId of availableIds) {
      await db.wishlistSubscription.upsert({
        where: { email_productId: { email: normalizedEmail, productId } },
        create: { email: normalizedEmail, productId },
        update: {}, // keep existing createdAt / notifiedAt
      });
      count++;
    }
    return { ok: true, count };
  } catch (err) {
    logger.error("[Wishlist] Subscribe failed:", err);
    return { ok: false, count: 0 };
  }
}
