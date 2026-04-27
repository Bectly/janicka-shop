import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  grossProfit,
  marginPct,
  conversionRate,
  avgDaysToSell,
} from "@/lib/cost-basis";

const STALE_DAYS = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const dateFrom = parseDate(sp.get("dateFrom"));
  const dateTo = parseDate(sp.get("dateTo"));
  const supplierId = sp.get("supplierId") || null;
  const bundleId = sp.get("bundleId") || null;
  const categoryId = sp.get("categoryId") || null;

  const db = await getDb();

  // Single product fetch with all relations needed for aggregation.
  // Scale assumption: a second-hand shop has on the order of 10² – 10⁴ pieces;
  // in-memory aggregation is simpler and avoids SQLite/libSQL date-format quirks
  // that arise with raw SQL strftime over Prisma's DateTime encoding.
  const products = await db.product.findMany({
    where: {
      ...(bundleId ? { bundleId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(supplierId
        ? { bundle: { is: { supplierId } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      price: true,
      costBasis: true,
      sold: true,
      createdAt: true,
      categoryId: true,
      bundleId: true,
      category: { select: { id: true, name: true } },
      bundle: {
        select: {
          id: true,
          invoiceNumber: true,
          totalPrice: true,
          supplier: { select: { id: true, name: true } },
        },
      },
      orderItems: {
        select: {
          price: true,
          order: { select: { createdAt: true, status: true } },
        },
      },
    },
  });

  type Row = (typeof products)[number];

  // Resolve "soldAt" for each product: earliest non-cancelled order createdAt.
  const soldAtById = new Map<string, Date | null>();
  for (const p of products) {
    let earliest: Date | null = null;
    for (const oi of p.orderItems) {
      if (!oi.order) continue;
      if (oi.order.status === "cancelled") continue;
      if (!earliest || oi.order.createdAt < earliest) earliest = oi.order.createdAt;
    }
    soldAtById.set(p.id, earliest);
  }

  // Apply date range against sale date for sold pieces, against createdAt for unsold.
  const inDateRange = (p: Row): boolean => {
    const ref = p.sold ? soldAtById.get(p.id) ?? p.createdAt : p.createdAt;
    if (dateFrom && ref < dateFrom) return false;
    if (dateTo && ref > dateTo) return false;
    return true;
  };

  const filtered = products.filter(inDateRange);

  // ---------- summary ----------
  let revenue = 0;
  let costBasisTotal = 0;
  for (const p of filtered) {
    if (!p.sold) continue;
    revenue += p.price;
    costBasisTotal += p.costBasis ?? 0;
  }
  const summary = {
    revenue,
    costBasis: costBasisTotal,
    grossProfit: grossProfit(revenue, costBasisTotal),
    marginPct: marginPct(revenue, costBasisTotal),
  };

  // ---------- byBundle ----------
  type BundleAgg = {
    bundleId: string;
    bundleName: string;
    supplierId: string | null;
    supplierName: string | null;
    invoiceNumber: string | null;
    totalCost: number;
    revenue: number;
    grossProfit: number;
    marginPct: number;
    conversionRate: number;
    avgDaysToSell: number;
    pieceCount: number;
    soldCount: number;
    _sellTimes: { createdAt: Date; soldAt: Date | null }[];
  };
  const bundleMap = new Map<string, BundleAgg>();
  for (const p of filtered) {
    if (!p.bundleId || !p.bundle) continue;
    let agg = bundleMap.get(p.bundleId);
    if (!agg) {
      agg = {
        bundleId: p.bundleId,
        bundleName: p.bundle.invoiceNumber ?? p.bundleId,
        supplierId: p.bundle.supplier?.id ?? null,
        supplierName: p.bundle.supplier?.name ?? null,
        invoiceNumber: p.bundle.invoiceNumber ?? null,
        totalCost: p.bundle.totalPrice ?? 0,
        revenue: 0,
        grossProfit: 0,
        marginPct: 0,
        conversionRate: 0,
        avgDaysToSell: 0,
        pieceCount: 0,
        soldCount: 0,
        _sellTimes: [],
      };
      bundleMap.set(p.bundleId, agg);
    }
    agg.pieceCount += 1;
    agg._sellTimes.push({ createdAt: p.createdAt, soldAt: soldAtById.get(p.id) ?? null });
    if (p.sold) {
      agg.soldCount += 1;
      agg.revenue += p.price;
    }
  }
  const byBundle = Array.from(bundleMap.values())
    .map((b) => {
      const gp = grossProfit(b.revenue, b.totalCost);
      return {
        bundleId: b.bundleId,
        bundleName: b.bundleName,
        supplierId: b.supplierId,
        supplierName: b.supplierName,
        invoiceNumber: b.invoiceNumber,
        totalCost: b.totalCost,
        revenue: b.revenue,
        grossProfit: gp,
        marginPct: b.revenue > 0 ? (gp / b.revenue) * 100 : 0,
        conversionRate: conversionRate(b.soldCount, b.pieceCount),
        avgDaysToSell: avgDaysToSell(b._sellTimes),
        pieceCount: b.pieceCount,
        soldCount: b.soldCount,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ---------- staleStock ----------
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * MS_PER_DAY);
  const staleStock = products
    .filter(
      (p) =>
        !p.sold &&
        p.bundleId &&
        p.createdAt < staleCutoff &&
        (!supplierId || p.bundle?.supplier?.id === supplierId) &&
        (!bundleId || p.bundleId === bundleId),
    )
    .map((p) => ({
      productId: p.id,
      name: p.name,
      bundleId: p.bundleId!,
      bundleName: p.bundle?.invoiceNumber ?? p.bundleId!,
      daysUnsold: Math.floor((now.getTime() - p.createdAt.getTime()) / MS_PER_DAY),
      price: p.price,
    }))
    .sort((a, b) => b.daysUnsold - a.daysUnsold);

  // ---------- byCategory ----------
  type CatAgg = {
    categoryId: string;
    categoryName: string;
    revenue: number;
    costBasis: number;
    pieceCount: number;
    soldCount: number;
  };
  const catMap = new Map<string, CatAgg>();
  for (const p of filtered) {
    let agg = catMap.get(p.categoryId);
    if (!agg) {
      agg = {
        categoryId: p.categoryId,
        categoryName: p.category?.name ?? p.categoryId,
        revenue: 0,
        costBasis: 0,
        pieceCount: 0,
        soldCount: 0,
      };
      catMap.set(p.categoryId, agg);
    }
    agg.pieceCount += 1;
    if (p.sold) {
      agg.soldCount += 1;
      agg.revenue += p.price;
      agg.costBasis += p.costBasis ?? 0;
    }
  }
  const byCategory = Array.from(catMap.values())
    .map((c) => {
      const gp = grossProfit(c.revenue, c.costBasis);
      return {
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        revenue: c.revenue,
        costBasis: c.costBasis,
        grossProfit: gp,
        marginPct: c.revenue > 0 ? (gp / c.revenue) * 100 : 0,
        pieceCount: c.pieceCount,
        soldCount: c.soldCount,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ---------- byMonth ----------
  type MonthAgg = { month: string; revenue: number; costBasis: number };
  const monthMap = new Map<string, MonthAgg>();
  for (const p of filtered) {
    if (!p.sold) continue;
    const sa = soldAtById.get(p.id);
    if (!sa) continue;
    const key = monthKey(sa);
    let agg = monthMap.get(key);
    if (!agg) {
      agg = { month: key, revenue: 0, costBasis: 0 };
      monthMap.set(key, agg);
    }
    agg.revenue += p.price;
    agg.costBasis += p.costBasis ?? 0;
  }
  const byMonth = Array.from(monthMap.values())
    .map((m) => ({
      month: m.month,
      revenue: m.revenue,
      costBasis: m.costBasis,
      grossProfit: grossProfit(m.revenue, m.costBasis),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    summary,
    byBundle,
    staleStock,
    byCategory,
    byMonth,
  });
}
