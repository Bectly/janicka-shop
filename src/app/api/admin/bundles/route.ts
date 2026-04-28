import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  grossProfit,
  marginPct,
  bundleROI,
  conversionRate,
  avgDaysToSell,
} from "@/lib/cost-basis";
import {
  classifyBundleStatus,
  enrichProducts,
  type BundleStatus,
} from "@/lib/bundles/roi";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const STALE_DAYS = 30;

type BundleListItem = {
  id: string;
  invoiceNumber: string | null;
  orderDate: string;
  receivedDate: string | null;
  supplier: { id: string; name: string };
  totalKg: number;
  investment: number;
  revenue: number;
  profit: number;
  roi: number;
  margin: number;
  sellThrough: number;
  avgSellDays: number;
  daysOld: number;
  pieceCount: number;
  soldCount: number;
  staleCount: number;
  status: BundleStatus;
};

async function loadBundlesList(): Promise<BundleListItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-bundles-list");

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setMonth(fromDate.getMonth() - 12);
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * MS_PER_DAY);

  const db = await getDb();
  const bundles = await db.supplierBundle.findMany({
    where: { orderDate: { gte: fromDate } },
    orderBy: { orderDate: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      orderDate: true,
      receivedDate: true,
      totalKg: true,
      totalPrice: true,
      supplier: { select: { id: true, name: true } },
      products: {
        select: {
          id: true,
          sku: true,
          name: true,
          price: true,
          costBasis: true,
          sold: true,
          createdAt: true,
          images: true,
          bundleLineId: true,
          orderItems: {
            select: {
              order: { select: { createdAt: true, status: true } },
            },
          },
        },
      },
    },
  });

  const items: BundleListItem[] = bundles.map((b) => {
    const enriched = enrichProducts(b.products, now);
    const totalCost = b.totalPrice;
    const revenue = enriched
      .filter((p) => p.sold)
      .reduce((acc, p) => acc + p.price, 0);
    const pieceCount = enriched.length;
    const soldCount = enriched.filter((p) => p.sold).length;
    const staleCount = enriched.filter(
      (p) => !p.sold && p.createdAt < staleCutoff,
    ).length;
    const daysOld = Math.floor(
      (now.getTime() - b.orderDate.getTime()) / MS_PER_DAY,
    );

    return {
      id: b.id,
      invoiceNumber: b.invoiceNumber,
      orderDate: b.orderDate.toISOString(),
      receivedDate: b.receivedDate ? b.receivedDate.toISOString() : null,
      supplier: b.supplier,
      totalKg: b.totalKg,
      investment: totalCost,
      revenue,
      profit: grossProfit(revenue, totalCost),
      roi: bundleROI(revenue, totalCost),
      margin: marginPct(revenue, totalCost),
      sellThrough: conversionRate(soldCount, pieceCount),
      avgSellDays: avgDaysToSell(enriched),
      daysOld,
      pieceCount,
      soldCount,
      staleCount,
      status: classifyBundleStatus({
        totalCost,
        revenue,
        pieceCount,
        soldCount,
      }),
    };
  });

  return items;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await loadBundlesList();
  return NextResponse.json({ bundles: items, count: items.length });
}
