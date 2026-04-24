"use server";

import { getDb } from "@/lib/db";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { z } from "zod";
import { logger } from "@/lib/logger";

const cartEmailSchema = z.object({
  email: z.string().email().max(254),
  cartItems: z
    .array(
      z.object({
        productId: z.string().max(128),
        name: z.string().max(300),
        price: z.number().finite().nonnegative(),
        size: z.string().max(50).optional(),
        color: z.string().max(50).optional(),
        image: z.string().max(2000).optional(),
        slug: z.string().max(300).optional(),
      })
    )
    .min(1)
    .max(50),
  cartTotal: z.number().finite().nonnegative(),
  marketingConsent: z.boolean(),
});

/**
 * Capture email on the cart page for abandoned cart recovery.
 * Creates/updates an AbandonedCart record with pageUrl="/cart".
 * Deduplicates by email — updates existing pending record.
 */
export async function captureCartEmail(input: {
  email: string;
  cartItems: {
    productId: string;
    name: string;
    price: number;
    size?: string;
    color?: string;
    image?: string;
    slug?: string;
  }[];
  cartTotal: number;
  marketingConsent: boolean;
}): Promise<void> {
  const parsed = cartEmailSchema.safeParse(input);
  if (!parsed.success) return;

  const { email, cartItems, cartTotal, marketingConsent } = parsed.data;

  try {
    const db = await getDb();
    const visitorId = await getOrCreateVisitorId();

    const existing = await db.abandonedCart.findFirst({
      where: { email, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      await db.abandonedCart.update({
        where: { id: existing.id },
        data: {
          cartItems: JSON.stringify(cartItems),
          cartTotal,
          visitorId,
          pageUrl: "/cart",
          marketingConsent,
        },
      });
    } else {
      await db.abandonedCart.create({
        data: {
          email,
          cartItems: JSON.stringify(cartItems),
          cartTotal,
          visitorId,
          pageUrl: "/cart",
          marketingConsent,
        },
      });
    }
  } catch (err) {
    logger.error("[CartEmail] Capture failed:", err);
  }
}
