import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * Token-based cart restore for abandoned-cart email one-click recovery.
 *
 * The `token` is the AbandonedCart.id (cuid) — opaque and non-guessable.
 * Returns the persisted cartItems so the client can hydrate Zustand even on
 * a different device than the one that abandoned the cart.
 *
 * Guard: only pending carts < 7 days old are restorable (matches cron TTL).
 * Single-use is NOT enforced — same email link can be clicked multiple times.
 */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token || typeof token !== "string" || token.length > 64 || !/^[a-z0-9]+$/i.test(token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const ip = await getClientIp();
  const rl = checkRateLimit(`cart-restore:${ip}`, 60, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const db = await getDb();
    const cart = await db.abandonedCart.findUnique({
      where: { id: token },
      select: { id: true, status: true, cartItems: true, createdAt: true },
    });

    if (!cart || cart.status !== "pending") {
      return NextResponse.json({ error: "Cart not available" }, { status: 404 });
    }

    const ageMs = Date.now() - cart.createdAt.getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (ageMs > SEVEN_DAYS_MS) {
      return NextResponse.json({ error: "Cart expired" }, { status: 410 });
    }

    let items: unknown;
    try {
      items = JSON.parse(cart.cartItems);
    } catch {
      return NextResponse.json({ error: "Corrupt cart data" }, { status: 422 });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Corrupt cart data" }, { status: 422 });
    }

    logger.info(`[CartRestored] cartId=${cart.id} items=${items.length}`);

    return NextResponse.json({ items });
  } catch (error) {
    logger.error("[CartRestore] Failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
