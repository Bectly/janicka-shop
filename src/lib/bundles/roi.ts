import { getDb } from "@/lib/db";
import {
  grossProfit,
  marginPct,
  bundleROI,
  conversionRate,
  avgDaysToSell,
} from "@/lib/cost-basis";

const STALE_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type BundleStatus =
  | "loss"
  | "pending"
  | "profit"
  | "done_profit"
  | "done_loss";

export type LineAgg = {
  id: string;
  code: string;
  name: string;
  pieces: number;
  sold: number;
  revenue: number;
  sellThroughPct: number;
  avgSellDays: number;
};

export type BundleProductSummary = {
  id: string;
  sku: string;
  name: string;
  price: number;
  image: string | null;
  daysToSell: number | null;
  daysOld: number;
};

export type CumulativePoint = {
  day: string;
  cumulativeRevenue: number;
};

export type BundleROI = {
  bundleId: string;
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
  status: BundleStatus;
  byLine: LineAgg[];
  stale: BundleProductSummary[];
  bestSellers: BundleProductSummary[];
  worstSellers: BundleProductSummary[];
  cumulative: CumulativePoint[];
  breakEvenDate: string | null;
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function firstImage(imagesJson: string): string | null {
  try {
    const arr = JSON.parse(imagesJson);
    if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
  } catch {
    /* noop */
  }
  return null;
}

export function classifyBundleStatus(args: {
  totalCost: number;
  revenue: number;
  pieceCount: number;
  soldCount: number;
}): BundleStatus {
  const { totalCost, revenue, pieceCount, soldCount } = args;
  const allSold = pieceCount > 0 && soldCount === pieceCount;
  const recovered = totalCost > 0 && revenue >= totalCost;
  if (allSold) return recovered ? "done_profit" : "done_loss";
  if (recovered) return "profit";
  if (revenue > 0) return "pending";
  return "loss";
}

export type EnrichedProduct = {
  id: string;
  sku: string;
  name: string;
  price: number;
  costBasis: number | null;
  sold: boolean;
  createdAt: Date;
  soldAt: Date | null;
  daysToSell: number | null;
  daysOld: number;
  image: string | null;
  bundleLineId: string | null;
};

type RawProduct = {
  id: string;
  sku: string;
  name: string;
  price: number;
  costBasis: number | null;
  sold: boolean;
  createdAt: Date;
  images: string;
  bundleLineId: string | null;
  orderItems: { order: { createdAt: Date; status: string } | null }[];
};

export function enrichProducts(
  products: RawProduct[],
  now: Date = new Date(),
): EnrichedProduct[] {
  return products.map((p) => {
    let soldAt: Date | null = null;
    for (const oi of p.orderItems) {
      if (!oi.order) continue;
      if (oi.order.status === "cancelled") continue;
      if (!soldAt || oi.order.createdAt < soldAt) soldAt = oi.order.createdAt;
    }
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: p.price,
      costBasis: p.costBasis,
      sold: p.sold,
      createdAt: p.createdAt,
      soldAt,
      daysToSell: soldAt ? daysBetween(p.createdAt, soldAt) : null,
      daysOld: daysBetween(p.createdAt, now),
      image: firstImage(p.images),
      bundleLineId: p.bundleLineId,
    };
  });
}

export function buildCumulative(
  enriched: EnrichedProduct[],
  totalCost: number,
  now: Date = new Date(),
): { cumulative: CumulativePoint[]; breakEvenDate: string | null } {
  const sales = enriched
    .filter((p): p is EnrichedProduct & { soldAt: Date } => p.soldAt !== null)
    .sort((a, b) => a.soldAt.getTime() - b.soldAt.getTime());

  const cumulative: CumulativePoint[] = [];
  let breakEvenDate: string | null = null;

  if (sales.length === 0) {
    return { cumulative, breakEvenDate };
  }

  cumulative.push({
    day: sales[0].soldAt.toISOString().slice(0, 10),
    cumulativeRevenue: 0,
  });

  let cum = 0;
  for (const s of sales) {
    cum += s.price;
    const day = s.soldAt.toISOString().slice(0, 10);
    const last = cumulative[cumulative.length - 1];
    if (last && last.day === day) {
      last.cumulativeRevenue = cum;
    } else {
      cumulative.push({ day, cumulativeRevenue: cum });
    }
    if (!breakEvenDate && totalCost > 0 && cum >= totalCost) {
      breakEvenDate = day;
    }
  }

  const todayStr = now.toISOString().slice(0, 10);
  if (cumulative[cumulative.length - 1].day !== todayStr) {
    cumulative.push({ day: todayStr, cumulativeRevenue: cum });
  }
  return { cumulative, breakEvenDate };
}

export async function calcBundleROI(
  bundleId: string,
): Promise<BundleROI | null> {
  const db = await getDb();
  const bundle = await db.supplierBundle.findUnique({
    where: { id: bundleId },
    select: {
      id: true,
      orderDate: true,
      totalPrice: true,
      lines: {
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          _count: { select: { products: true } },
        },
      },
      products: {
        orderBy: { createdAt: "asc" },
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
  if (!bundle) return null;

  const now = new Date();
  const enriched = enrichProducts(bundle.products, now);

  const totalCost = bundle.totalPrice;
  const revenue = enriched
    .filter((p) => p.sold)
    .reduce((acc, p) => acc + p.price, 0);
  const profit = grossProfit(revenue, totalCost);
  const margin = marginPct(revenue, totalCost);
  const roi = bundleROI(revenue, totalCost);
  const pieceCount = enriched.length;
  const soldCount = enriched.filter((p) => p.sold).length;
  const sellThrough = conversionRate(soldCount, pieceCount);
  const avgSellDays = avgDaysToSell(enriched);
  const daysOld = daysBetween(bundle.orderDate, now);
  const status = classifyBundleStatus({
    totalCost,
    revenue,
    pieceCount,
    soldCount,
  });

  const byLine: LineAgg[] = bundle.lines.map((line) => {
    const items = enriched.filter((p) => p.bundleLineId === line.id);
    const lineSold = items.filter((p) => p.sold).length;
    const lineRevenue = items
      .filter((p) => p.sold)
      .reduce((acc, p) => acc + p.price, 0);
    return {
      id: line.id,
      code: line.code,
      name: line.name,
      pieces: items.length || line._count.products,
      sold: lineSold,
      revenue: lineRevenue,
      sellThroughPct: conversionRate(lineSold, items.length),
      avgSellDays: avgDaysToSell(items),
    };
  });

  const toSummary = (p: EnrichedProduct): BundleProductSummary => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    price: p.price,
    image: p.image,
    daysToSell: p.daysToSell,
    daysOld: p.daysOld,
  });

  const bestSellers = enriched
    .filter((p) => p.sold && p.daysToSell !== null)
    .sort((a, b) => (a.daysToSell ?? 0) - (b.daysToSell ?? 0))
    .slice(0, 3)
    .map(toSummary);

  const worstSellers = enriched
    .filter((p) => !p.sold)
    .sort((a, b) => b.daysOld - a.daysOld)
    .slice(0, 3)
    .map(toSummary);

  const staleCutoff = new Date(now.getTime() - STALE_DAYS * MS_PER_DAY);
  const stale = enriched
    .filter((p) => !p.sold && p.createdAt < staleCutoff)
    .sort((a, b) => b.daysOld - a.daysOld)
    .map(toSummary);

  const { cumulative, breakEvenDate } = buildCumulative(
    enriched,
    totalCost,
    now,
  );

  return {
    bundleId: bundle.id,
    investment: totalCost,
    revenue,
    profit,
    roi,
    margin,
    sellThrough,
    avgSellDays,
    daysOld,
    pieceCount,
    soldCount,
    status,
    byLine,
    stale,
    bestSellers,
    worstSellers,
    cumulative,
    breakEvenDate,
  };
}
