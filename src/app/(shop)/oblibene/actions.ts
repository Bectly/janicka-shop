"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logEvent } from "@/lib/audit-log";
import { invalidateCustomerScope } from "@/lib/customer-cache";

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

  // Defense-in-depth: signed-in customers exempt; unauth callers capped at
  // 10/min/IP so an attacker can't weaponize bulk subscribe (up to 100 ids
  // per call, no double-opt-in) against a third-party email.
  const session = await auth();
  const isCustomer = session?.user?.role === "customer";
  if (!isCustomer) {
    const ip = await getClientIp();
    const rl = checkRateLimit(`wishlist-bulk:${ip}`, 10, 60_000);
    if (!rl.success) return { ok: false, count: 0 };
  }

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

const singleSubscribeSchema = z.object({
  productId: z.string().max(128),
  // Email is optional: signed-in customers are subscribed via session.
  email: z.string().email().max(254).optional(),
});

export type SingleSubscribeResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "rate_limited" | "auth_required" | "error" };

/**
 * Per-product wishlist subscribe for PDP "notify me if sold" capture.
 * Signed-in customers auto-subscribe using session email — client omits `email`.
 * Unauth visitors must pass `email`; rate-limited per IP (5/min).
 * Silently no-ops if the product is already sold (nothing to wait for).
 */
export async function subscribeSingleWishlistNotification(input: {
  productId: string;
  email?: string;
}): Promise<SingleSubscribeResult> {
  const parsed = singleSubscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const session = await auth();
  const sessionEmail =
    session?.user?.role === "customer" ? session.user.email ?? null : null;

  const email = sessionEmail ?? parsed.data.email;
  if (!email) return { ok: false, reason: "auth_required" };

  if (!sessionEmail) {
    const ip = await getClientIp();
    const rl = checkRateLimit(`wishlist-subscribe:${ip}`, 5, 60_000);
    if (!rl.success) return { ok: false, reason: "rate_limited" };
  }

  const normalizedEmail = email.toLowerCase();
  const { productId } = parsed.data;

  try {
    const db = await getDb();

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { active: true, sold: true },
    });
    if (!product || !product.active || product.sold) {
      return { ok: true };
    }

    await db.wishlistSubscription.upsert({
      where: { email_productId: { email: normalizedEmail, productId } },
      create: { email: normalizedEmail, productId },
      update: {},
    });
    return { ok: true };
  } catch (err) {
    logger.error("[Wishlist] Single subscribe failed:", err);
    return { ok: false, reason: "error" };
  }
}

export async function removeFromWishlist(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { ok: false, error: "Nejste přihlášena." };
  }

  const db = await getDb();
  await db.customerWishlist.deleteMany({
    where: { customerId: session.user.id, productId },
  });
  await logEvent({
    customerId: session.user.id,
    action: "wishlist_remove",
    metadata: { productId },
  });

  invalidateCustomerScope(session.user.id, "wishlist");
  revalidatePath("/oblibene");
  return { ok: true };
}

export async function addToWishlist(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { ok: false, error: "Nejste přihlášena." };
  }

  const db = await getDb();
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { active: true },
  });
  if (!product?.active) {
    return { ok: false, error: "Produkt není dostupný." };
  }

  await db.customerWishlist.upsert({
    where: {
      customerId_productId: { customerId: session.user.id, productId },
    },
    create: { customerId: session.user.id, productId },
    update: {},
  });
  await logEvent({
    customerId: session.user.id,
    action: "wishlist_add",
    metadata: { productId },
  });

  invalidateCustomerScope(session.user.id, "wishlist");
  return { ok: true };
}

export async function toggleWishlist(
  productId: string,
): Promise<{ ok: boolean; added: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { ok: false, added: false, error: "Nejste přihlášena." };
  }

  const db = await getDb();
  const customerId = session.user.id;

  const existing = await db.customerWishlist.findUnique({
    where: { customerId_productId: { customerId, productId } },
    select: { customerId: true },
  });

  if (existing) {
    await db.customerWishlist.deleteMany({
      where: { customerId, productId },
    });
    await logEvent({
      customerId,
      action: "wishlist_remove",
      metadata: { productId },
    });
    invalidateCustomerScope(customerId, "wishlist");
    return { ok: true, added: false };
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { active: true },
  });
  if (!product?.active) {
    return { ok: false, added: false, error: "Produkt není dostupný." };
  }

  await db.customerWishlist.upsert({
    where: { customerId_productId: { customerId, productId } },
    create: { customerId, productId },
    update: {},
  });
  await logEvent({
    customerId,
    action: "wishlist_add",
    metadata: { productId },
  });
  invalidateCustomerScope(customerId, "wishlist");
  return { ok: true, added: true };
}

