import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { grossProfit } from "@/lib/cost-basis";
import { ProfitTabs } from "./profit-tabs";

export const metadata: Metadata = {
  title: "Reporty — Zisk",
};

export const dynamic = "force-dynamic";

type BundleRow = {
  bundleId: string;
  bundleName: string;
  pieceCount: number;
  totalCost: number;
  soldCount: number;
  revenue: number;
  grossProfit: number;
  marginPct: number;
};

type CategoryRow = {
  code: string;
  name: string;
  soldCount: number;
  revenue: number;
  costBasis: number;
  grossProfit: number;
  marginPct: number;
};

type MonthRow = {
  month: string;
  bundleCount: number;
  soldCount: number;
  revenue: number;
  costBasis: number;
  grossProfit: number;
  marginPct: number;
};

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function loadProfitReport(): Promise<{
  byBundle: BundleRow[];
  byCategory: CategoryRow[];
  byMonth: MonthRow[];
  orphanCount: number;
}> {
  const db = await getDb();

  const products = await db.product.findMany({
    select: {
      id: true,
      price: true,
      costBasis: true,
      sold: true,
      bundleId: true,
      bundleLineId: true,
      bundleLine: { select: { code: true, name: true } },
      bundle: {
        select: {
          id: true,
          invoiceNumber: true,
          totalPrice: true,
          orderDate: true,
        },
      },
      orderItems: {
        select: { order: { select: { status: true } } },
      },
    },
  });

  // ---------- byBundle ----------
  const bundleMap = new Map<string, BundleRow & { _hasCost: boolean }>();
  for (const p of products) {
    if (!p.bundleId || !p.bundle) continue;
    let agg = bundleMap.get(p.bundleId);
    if (!agg) {
      agg = {
        bundleId: p.bundleId,
        bundleName: p.bundle.invoiceNumber ?? p.bundleId.slice(0, 8),
        pieceCount: 0,
        totalCost: p.bundle.totalPrice ?? 0,
        soldCount: 0,
        revenue: 0,
        grossProfit: 0,
        marginPct: 0,
        _hasCost: true,
      };
      bundleMap.set(p.bundleId, agg);
    }
    agg.pieceCount += 1;
    if (p.sold) {
      agg.soldCount += 1;
      agg.revenue += p.price;
    }
  }
  const byBundle: BundleRow[] = Array.from(bundleMap.values())
    .map((b) => {
      const gp = grossProfit(b.revenue, b.totalCost);
      return {
        bundleId: b.bundleId,
        bundleName: b.bundleName,
        pieceCount: b.pieceCount,
        totalCost: b.totalCost,
        soldCount: b.soldCount,
        revenue: b.revenue,
        grossProfit: gp,
        marginPct: b.revenue > 0 ? (gp / b.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ---------- byCategory (bundleLine.code) ----------
  const catMap = new Map<string, CategoryRow>();
  for (const p of products) {
    if (!p.bundleLine) continue;
    const key = p.bundleLine.code;
    let agg = catMap.get(key);
    if (!agg) {
      agg = {
        code: key,
        name: p.bundleLine.name,
        soldCount: 0,
        revenue: 0,
        costBasis: 0,
        grossProfit: 0,
        marginPct: 0,
      };
      catMap.set(key, agg);
    }
    if (p.sold) {
      agg.soldCount += 1;
      agg.revenue += p.price;
      agg.costBasis += p.costBasis ?? 0;
    }
  }
  const byCategory: CategoryRow[] = Array.from(catMap.values())
    .map((c) => {
      const gp = grossProfit(c.revenue, c.costBasis);
      return {
        ...c,
        grossProfit: gp,
        marginPct: c.revenue > 0 ? (gp / c.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ---------- byMonth (bundle.orderDate) ----------
  type MonthAgg = {
    month: string;
    bundles: Set<string>;
    soldCount: number;
    revenue: number;
    costBasis: number;
  };
  const monthMap = new Map<string, MonthAgg>();
  for (const p of products) {
    if (!p.bundle?.orderDate || !p.bundleId) continue;
    const key = monthKey(p.bundle.orderDate);
    let agg = monthMap.get(key);
    if (!agg) {
      agg = {
        month: key,
        bundles: new Set<string>(),
        soldCount: 0,
        revenue: 0,
        costBasis: 0,
      };
      monthMap.set(key, agg);
    }
    agg.bundles.add(p.bundleId);
    if (p.sold) {
      agg.soldCount += 1;
      agg.revenue += p.price;
      agg.costBasis += p.costBasis ?? 0;
    }
  }
  const byMonth: MonthRow[] = Array.from(monthMap.values())
    .map((m) => {
      const gp = grossProfit(m.revenue, m.costBasis);
      return {
        month: m.month,
        bundleCount: m.bundles.size,
        soldCount: m.soldCount,
        revenue: m.revenue,
        costBasis: m.costBasis,
        grossProfit: gp,
        marginPct: m.revenue > 0 ? (gp / m.revenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));

  const orphanCount = products.filter((p) => p.bundleId === null).length;

  return { byBundle, byCategory, byMonth, orphanCount };
}

export default async function ProfitReportPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/admin/login");
  }

  const data = await loadProfitReport();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Reporty — Zisk
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Přehled tržeb, nákladů a marže podle balíku, kategorie a měsíce.
        </p>
      </header>

      <ProfitTabs
        byBundle={data.byBundle}
        byCategory={data.byCategory}
        byMonth={data.byMonth}
      />

      <footer className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Produkty bez přiřazení k balíku (Vinted / staré importy):{" "}
        <span className="font-semibold text-foreground">{data.orphanCount}</span>
      </footer>
    </div>
  );
}
