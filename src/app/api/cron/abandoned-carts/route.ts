import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendAbandonedCartEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

/**
 * Abandoned cart recovery email processor.
 * Designed to be called by Vercel Cron (vercel.json) every 15 minutes.
 * Protected by CRON_SECRET to prevent unauthorized access.
 *
 * Email sequence timing:
 *   Email 1: 30-60 min after cart capture
 *   Email 2: 12-24h after cart capture
 *   Email 3: 48-72h after cart capture
 *   Expire:  after 7 days
 */
export async function GET(request: Request) {
  // Verify cron secret — prevents unauthorized access.
  // Fail closed: if CRON_SECRET is not configured, deny all requests rather
  // than leaving the endpoint open to unauthenticated callers.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const now = new Date();

  // Time thresholds
  const email1After = new Date(now.getTime() - 45 * 60 * 1000); // 45 min ago (sweet spot: 30-60)
  const email2After = new Date(now.getTime() - 18 * 60 * 60 * 1000); // 18h ago (sweet spot: 12-24)
  const email3After = new Date(now.getTime() - 60 * 60 * 60 * 1000); // 60h ago (sweet spot: 48-72)
  const expireAfter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  let sent = 0;
  let expired = 0;

  try {
    // 1. Expire old carts (older than 7 days, still pending)
    const expiredResult = await db.abandonedCart.updateMany({
      where: {
        status: "pending",
        createdAt: { lt: expireAfter },
      },
      data: { status: "expired" },
    });
    expired = expiredResult.count;

    // 2. Find carts ready for Email 1 (created > 45min ago, email1 not sent, consent given)
    // GDPR: only send recovery emails when customer explicitly opted in
    const readyForEmail1 = await db.abandonedCart.findMany({
      where: {
        status: "pending",
        marketingConsent: true,
        email1SentAt: null,
        createdAt: { lt: email1After },
      },
      take: 50, // process in batches to avoid timeout
    });

    for (const cart of readyForEmail1) {
      const items = parseCartItems(cart.cartItems);
      if (items.length === 0) continue;

      const success = await sendAbandonedCartEmail(1, {
        email: cart.email,
        customerName: cart.customerName,
        items,
        cartTotal: cart.cartTotal,
        cartId: cart.id,
      });

      if (success) {
        await db.abandonedCart.update({
          where: { id: cart.id },
          data: { email1SentAt: now },
        });
        sent++;
      }
    }

    // 3. Find carts ready for Email 2 (created > 18h ago, email1 sent > 6h ago, email2 not sent)
    // Guard: require email1SentAt < 6h ago so email 2 is never sent immediately after email 1
    // on the same cron run where a cart crosses BOTH the email1 and email2 age thresholds.
    const email2MinGapAfterEmail1 = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const readyForEmail2 = await db.abandonedCart.findMany({
      where: {
        status: "pending",
        marketingConsent: true,
        email1SentAt: { not: null, lt: email2MinGapAfterEmail1 },
        email2SentAt: null,
        createdAt: { lt: email2After },
      },
      take: 50,
    });

    for (const cart of readyForEmail2) {
      const items = parseCartItems(cart.cartItems);
      if (items.length === 0) continue;

      // Check which items have been sold since capture (by ID to avoid name collisions)
      const soldProductIds = await getSoldProductIds(db, items);

      const success = await sendAbandonedCartEmail(
        2,
        { email: cart.email, customerName: cart.customerName, items, cartTotal: cart.cartTotal, cartId: cart.id },
        soldProductIds
      );

      if (success) {
        await db.abandonedCart.update({
          where: { id: cart.id },
          data: { email2SentAt: now },
        });
        sent++;
      }
    }

    // 4. Find carts ready for Email 3 (created > 60h ago, email2 sent > 12h ago, email3 not sent)
    // Guard: require email2SentAt < 12h ago to ensure minimum spacing between email 2 and 3.
    const email3MinGapAfterEmail2 = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const readyForEmail3 = await db.abandonedCart.findMany({
      where: {
        status: "pending",
        marketingConsent: true,
        email2SentAt: { not: null, lt: email3MinGapAfterEmail2 },
        email3SentAt: null,
        createdAt: { lt: email3After },
      },
      take: 50,
    });

    for (const cart of readyForEmail3) {
      const items = parseCartItems(cart.cartItems);
      if (items.length === 0) continue;

      // Check sold status by productId to avoid false positives from name collisions
      const soldProductIds = await getSoldProductIds(db, items);

      // If ALL items are sold, skip email 3 (no value for the customer)
      if (soldProductIds.length >= items.length) {
        await db.abandonedCart.update({
          where: { id: cart.id },
          data: { email3SentAt: now, status: "expired" },
        });
        continue;
      }

      const success = await sendAbandonedCartEmail(
        3,
        { email: cart.email, customerName: cart.customerName, items, cartTotal: cart.cartTotal, cartId: cart.id },
        soldProductIds
      );

      if (success) {
        await db.abandonedCart.update({
          where: { id: cart.id },
          data: { email3SentAt: now, status: "expired" }, // sequence complete
        });
        sent++;
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      expired,
      processed: readyForEmail1.length + readyForEmail2.length + readyForEmail3.length,
    });
  } catch (error) {
    logger.error("[Cron] Abandoned cart processing failed:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  slug?: string;
  size?: string;
  color?: string;
}

function parseCartItems(json: string): CartItem[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Return the productIds of items that have been sold since the cart was captured.
 * Using IDs (not names) avoids false-positive matches when two cart items share
 * the same display name.
 */
async function getSoldProductIds(
  db: Awaited<ReturnType<typeof getDb>>,
  items: CartItem[]
): Promise<string[]> {
  const productIds = items.map((i) => i.productId);
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, sold: true },
  });
  const soldIds = new Set(products.filter((p) => p.sold).map((p) => p.id));
  return items.filter((i) => soldIds.has(i.productId)).map((i) => i.productId);
}
