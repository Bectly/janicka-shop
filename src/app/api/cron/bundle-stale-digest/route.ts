import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { sendTelegramAdminMessage } from "@/lib/telegram";
import { logger } from "@/lib/logger";

const STALE_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MAX_BUNDLES_IN_DIGEST = 10;

/**
 * J13-B2: weekly Telegram digest of bundles with stale (>30d unsold) products.
 * Scheduled every Monday morning via vercel.json.
 */
export const GET = wrapCronRoute("bundle-stale-digest", async () => {
  const db = await getDb();
  const cutoff = new Date(Date.now() - STALE_DAYS * MS_PER_DAY);

  // Pull every active bundle with at least one unsold-and-stale product.
  const bundles = await db.supplierBundle.findMany({
    where: {
      status: { in: ["received", "unpacked", "ordered"] },
      products: {
        some: { sold: false, active: true, createdAt: { lt: cutoff } },
      },
    },
    select: {
      id: true,
      invoiceNumber: true,
      orderDate: true,
      totalPrice: true,
      supplier: { select: { name: true } },
      products: {
        where: { sold: false, active: true, createdAt: { lt: cutoff } },
        select: {
          id: true,
          name: true,
          price: true,
          createdAt: true,
        },
      },
    },
    orderBy: { orderDate: "desc" },
  });

  if (bundles.length === 0) {
    return NextResponse.json({
      ok: true,
      bundlesScanned: 0,
      staleProducts: 0,
      sent: false,
      reason: "no-stale-bundles",
    });
  }

  const now = Date.now();
  const enriched = bundles
    .map((b) => {
      const stale = b.products.map((p) => ({
        ...p,
        daysOld: Math.floor(
          (now - p.createdAt.getTime()) / MS_PER_DAY,
        ),
      }));
      stale.sort((a, b2) => b2.daysOld - a.daysOld);
      return {
        id: b.id,
        label:
          b.invoiceNumber?.trim() ||
          `${b.supplier.name} ${b.orderDate.toISOString().slice(0, 10)}`,
        staleCount: stale.length,
        oldestDays: stale[0]?.daysOld ?? 0,
        topItems: stale.slice(0, 3),
        totalValue: stale.reduce((acc, p) => acc + p.price, 0),
      };
    })
    .sort((a, b2) => b2.staleCount - a.staleCount);

  const totalStale = enriched.reduce((acc, b) => acc + b.staleCount, 0);
  const totalValue = enriched.reduce((acc, b) => acc + b.totalValue, 0);

  const lines: string[] = [
    `📦 Týdenní přehled stojících kusů (>${STALE_DAYS} d)`,
    `Balíky: ${enriched.length} · Kusy: ${totalStale} · Hodnota: ${totalValue.toLocaleString("cs-CZ")} Kč`,
    "",
  ];

  for (const b of enriched.slice(0, MAX_BUNDLES_IN_DIGEST)) {
    lines.push(
      `• ${b.label} — ${b.staleCount} ks, nejstarší ${b.oldestDays} d`,
    );
  }
  if (enriched.length > MAX_BUNDLES_IN_DIGEST) {
    lines.push(
      `… a ${enriched.length - MAX_BUNDLES_IN_DIGEST} dalších balíků.`,
    );
  }
  lines.push("", "Doporučení: zlevni, přesuň na Vinted, nebo přebal.");

  const result = await sendTelegramAdminMessage(lines.join("\n"));
  if (!result.sent) {
    logger.warn(
      `[cron:bundle-stale-digest] Telegram skipped: ${result.skipped ?? result.error ?? "unknown"}`,
    );
  }

  return NextResponse.json({
    ok: true,
    bundlesScanned: enriched.length,
    staleProducts: totalStale,
    sent: result.sent,
  });
});
