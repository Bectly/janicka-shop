import { getDb } from "@/lib/db";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";
import { sendTelegramAdminMessage } from "@/lib/telegram";
import { logger } from "@/lib/logger";

const NOTIFY_KEY_PREFIX = "bundleBreakEvenNotified:";

type BundleBreakEvenSummary = {
  bundleId: string;
  invoiceLabel: string;
  totalCost: number;
  revenue: number;
  pieceCount: number;
  soldCount: number;
};

async function getBundleBreakEvenSummary(
  bundleId: string,
): Promise<BundleBreakEvenSummary | null> {
  const db = await getDb();
  const bundle = await db.supplierBundle.findUnique({
    where: { id: bundleId },
    select: {
      id: true,
      invoiceNumber: true,
      totalPrice: true,
      products: {
        select: {
          price: true,
          sold: true,
          orderItems: {
            select: { order: { select: { status: true } } },
          },
        },
      },
    },
  });
  if (!bundle) return null;

  let revenue = 0;
  let soldCount = 0;
  for (const p of bundle.products) {
    const hasNonCancelledOrder = p.orderItems.some(
      (oi) => oi.order && oi.order.status !== "cancelled",
    );
    const counted = p.sold || hasNonCancelledOrder;
    if (counted) {
      soldCount += 1;
      revenue += p.price;
    }
  }

  return {
    bundleId: bundle.id,
    invoiceLabel:
      bundle.invoiceNumber?.trim() ||
      `#${bundle.id.slice(-6).toUpperCase()}`,
    totalCost: bundle.totalPrice,
    revenue,
    pieceCount: bundle.products.length,
    soldCount,
  };
}

/**
 * Check whether a bundle has just crossed its break-even point. Idempotent —
 * uses SiteSetting flag `bundleBreakEvenNotified:{bundleId}` so it only fires
 * once per bundle. Safe to call from multiple triggers (order paid, batch seal,
 * manual ROI fetch).
 */
export async function checkBundleBreakEven(
  bundleId: string,
): Promise<{ notified: boolean; reason?: string }> {
  try {
    const summary = await getBundleBreakEvenSummary(bundleId);
    if (!summary) return { notified: false, reason: "bundle-not-found" };
    if (summary.totalCost <= 0) {
      return { notified: false, reason: "no-cost" };
    }
    if (summary.revenue < summary.totalCost) {
      return { notified: false, reason: "below-break-even" };
    }

    const flagKey = `${NOTIFY_KEY_PREFIX}${bundleId}`;
    const existing = await getSiteSetting(flagKey);
    if (existing) {
      return { notified: false, reason: "already-notified" };
    }

    const profit = summary.revenue - summary.totalCost;
    const message = [
      `🎉 OPATEX ${summary.invoiceLabel} se právě zaplatil!`,
      `Investice: ${summary.totalCost.toLocaleString("cs-CZ")} Kč`,
      `Tržby: ${summary.revenue.toLocaleString("cs-CZ")} Kč`,
      `Zisk doteď: ${profit.toLocaleString("cs-CZ")} Kč`,
      `Prodáno: ${summary.soldCount}/${summary.pieceCount} ks`,
    ].join("\n");

    const result = await sendTelegramAdminMessage(message);
    // Persist flag regardless of Telegram delivery — env may be unset in dev,
    // we still want to suppress duplicate "first-crossover" detections.
    await setSiteSetting(
      flagKey,
      JSON.stringify({
        notifiedAt: new Date().toISOString(),
        revenue: summary.revenue,
        totalCost: summary.totalCost,
        telegramSent: result.sent,
      }),
    );
    return { notified: result.sent };
  } catch (err) {
    logger.error(
      `[break-even-alert] failed for bundle ${bundleId}:`,
      err,
    );
    return { notified: false, reason: "error" };
  }
}

/**
 * Find every bundle touched by the order's items and check break-even on each.
 */
export async function checkBundlesForOrder(orderId: string): Promise<void> {
  try {
    const db = await getDb();
    const items = await db.orderItem.findMany({
      where: { orderId },
      select: { product: { select: { bundleId: true } } },
    });
    const bundleIds = Array.from(
      new Set(
        items
          .map((i) => i.product?.bundleId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );
    for (const bundleId of bundleIds) {
      await checkBundleBreakEven(bundleId);
    }
  } catch (err) {
    logger.error(
      `[break-even-alert] checkBundlesForOrder failed for ${orderId}:`,
      err,
    );
  }
}
