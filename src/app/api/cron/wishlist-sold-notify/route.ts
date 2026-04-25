import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireCronSecret } from "@/lib/cron-auth";
import { sendWishlistSoldNotifications } from "@/lib/email/wishlist-sold";
import { logger } from "@/lib/logger";

/**
 * Wishlist sold-item notify cron — fallback sender.
 *
 * Primary path is sendWishlistSoldNotifications fire-and-forget from
 * checkout/actions.ts after products transition to sold=true. This cron
 * catches rows the checkout fire missed (admin mark-sold, manual order
 * creation, payment-return rescue path, fire-and-forget crash) by selecting
 * WishlistSubscription rows with notifiedAt IS NULL whose target product is
 * already sold. Runs every 30 minutes.
 *
 * WishlistSubscription has no defined Prisma relation to Product, so we
 * resolve it in two steps: pull pending productIds, then check which are
 * sold. Batch limit: 200 pending rows per run.
 *
 * Protected by CRON_SECRET.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const db = await getDb();

  try {
    const pending = await db.wishlistSubscription.findMany({
      where: { notifiedAt: null },
      take: 200,
      orderBy: { createdAt: "asc" },
      select: { productId: true },
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no pending" });
    }

    const pendingIds = Array.from(new Set(pending.map((p) => p.productId)));

    const soldProducts = await db.product.findMany({
      where: { id: { in: pendingIds }, sold: true },
      select: {
        id: true,
        name: true,
        brand: true,
        categoryId: true,
        sizes: true,
        images: true,
      },
    });

    if (soldProducts.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        reason: "no sold products in pending",
        pending: pendingIds.length,
      });
    }

    await sendWishlistSoldNotifications(soldProducts);

    return NextResponse.json({
      ok: true,
      processed: soldProducts.length,
      pending: pendingIds.length,
    });
  } catch (error) {
    logger.error("[Cron:wishlist-sold-notify] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
