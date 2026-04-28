import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import type { Metadata } from "next";
import { Package, Filter } from "lucide-react";
import { getDb } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import {
  grossProfit,
  marginPct,
  conversionRate,
  avgDaysToSell,
} from "@/lib/cost-basis";
import {
  BundleRoiCard,
  type BundleRoiData,
  type BundleStatus,
} from "./bundle-roi-card";

export const metadata: Metadata = {
  title: "Balíky — ROI přehled",
};

const STALE_DAYS = 90;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const PERIODS = [
  { value: "3", label: "3 měsíce" },
  { value: "6", label: "6 měsíců" },
  { value: "12", label: "12 měsíců" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["value"];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Všechny stavy" },
  { value: "loss", label: "🔴 Ztrátové" },
  { value: "pending", label: "🟡 Break-even pending" },
  { value: "profit", label: "🟢 Ziskové" },
  { value: "done_profit", label: "✅ Vyplatilo se" },
  { value: "done_loss", label: "💀 Vyprodáno se ztrátou" },
];

type Search = {
  supplier?: string;
  period?: string;
  status?: string;
};

function pickPeriod(value: string | undefined): PeriodKey {
  if (value === "3" || value === "6" || value === "12") return value;
  return "12";
}

async function getSuppliersList() {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-suppliers");

  const db = await getDb();
  return db.supplier.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

async function getBundlesAggregate(opts: {
  supplierId: string | null;
  fromDate: Date;
}) {
  const db = await getDb();
  return db.supplierBundle.findMany({
    where: {
      orderDate: { gte: opts.fromDate },
      ...(opts.supplierId ? { supplierId: opts.supplierId } : {}),
    },
    orderBy: { orderDate: "desc" },
    include: {
      supplier: { select: { id: true, name: true } },
      products: {
        select: {
          id: true,
          price: true,
          sold: true,
          createdAt: true,
          orderItems: {
            select: {
              order: { select: { createdAt: true, status: true } },
            },
          },
        },
      },
    },
  });
}

function classifyStatus(args: {
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

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function AdminBundlesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await connection();
  const sp = await searchParams;

  const supplierId =
    sp.supplier && sp.supplier !== "all" ? sp.supplier : null;
  const period = pickPeriod(sp.period);
  const statusFilter = sp.status ?? "all";

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setMonth(fromDate.getMonth() - Number(period));
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * MS_PER_DAY);
  const yearAgo = new Date(now);
  yearAgo.setMonth(yearAgo.getMonth() - 12);

  const [suppliers, bundles] = await Promise.all([
    getSuppliersList(),
    getBundlesAggregate({ supplierId, fromDate }),
  ]);

  // Aggregate per bundle
  const cards: BundleRoiData[] = bundles.map((b) => {
    let revenue = 0;
    let soldCount = 0;
    let staleCount = 0;
    const sellTimes: { createdAt: Date; soldAt: Date | null }[] = [];

    for (const p of b.products) {
      // Earliest non-cancelled order createdAt = soldAt
      let soldAt: Date | null = null;
      for (const oi of p.orderItems) {
        if (!oi.order) continue;
        if (oi.order.status === "cancelled") continue;
        if (!soldAt || oi.order.createdAt < soldAt) soldAt = oi.order.createdAt;
      }
      sellTimes.push({ createdAt: p.createdAt, soldAt });

      if (p.sold) {
        soldCount += 1;
        revenue += p.price;
      } else if (p.createdAt < staleCutoff) {
        staleCount += 1;
      }
    }

    const pieceCount = b.products.length;
    const totalCost = b.totalPrice;
    const profit = grossProfit(revenue, totalCost);
    const margin = marginPct(revenue, totalCost);
    const sellThroughPct = conversionRate(soldCount, pieceCount);
    const avgSell = avgDaysToSell(sellTimes);
    const status = classifyStatus({
      totalCost,
      revenue,
      pieceCount,
      soldCount,
    });

    return {
      id: b.id,
      name: b.invoiceNumber ?? `Balík ${formatDay(b.orderDate)}`,
      supplierName: b.supplier.name,
      orderDate: b.orderDate,
      totalKg: b.totalKg,
      totalCost,
      revenue,
      profit,
      marginPct: margin,
      sellThroughPct,
      avgSellDays: avgSell,
      pieceCount,
      soldCount,
      staleCount,
      status,
    };
  });

  const visibleCards =
    statusFilter === "all"
      ? cards
      : cards.filter((c) => c.status === statusFilter);

  // 12-month rolling summary (uses ALL bundles in last 12mo, ignoring period filter
  // so the strip stays as a stable trailing-year benchmark).
  // We re-derive against bundles that overlap the 12mo window from the already-
  // fetched data when period === 12; otherwise we issue no extra query and the
  // strip falls back to the visible period.
  const yearScope = period === "12" ? cards : cards;
  let yearInvested = 0;
  let yearRevenue = 0;
  let yearPieces = 0;
  let yearSold = 0;
  for (const c of yearScope) {
    if (c.orderDate < yearAgo) continue;
    yearInvested += c.totalCost;
    yearRevenue += c.revenue;
    yearPieces += c.pieceCount;
    yearSold += c.soldCount;
  }
  const yearProfit = yearRevenue - yearInvested;
  const yearMargin = yearRevenue > 0 ? (yearProfit / yearRevenue) * 100 : 0;
  const yearSellThrough =
    yearPieces > 0 ? (yearSold / yearPieces) * 100 : 0;

  // Filter form helper: preserve other params via hidden inputs.
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Balíky — ROI přehled
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cards.length}{" "}
            {cards.length === 1
              ? "balík"
              : cards.length >= 2 && cards.length <= 4
                ? "balíky"
                : "balíků"}{" "}
            za posledních {period}{" "}
            {period === "12" ? "měsíců" : "měsíce"}
          </p>
        </div>
        <Link
          href="/admin/suppliers"
          className="text-sm font-medium text-primary hover:underline"
        >
          Spravovat dodavatele →
        </Link>
      </div>

      {/* Filter bar */}
      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm"
        aria-label="Filtr balíků"
      >
        <div className="flex flex-1 min-w-[180px] flex-col gap-1">
          <label
            htmlFor="filter-supplier"
            className="text-xs font-medium text-muted-foreground"
          >
            Dodavatel
          </label>
          <select
            id="filter-supplier"
            name="supplier"
            defaultValue={supplierId ?? "all"}
            className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">Všichni dodavatelé</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-period"
            className="text-xs font-medium text-muted-foreground"
          >
            Období
          </label>
          <select
            id="filter-period"
            name="period"
            defaultValue={period}
            className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-status"
            className="text-xs font-medium text-muted-foreground"
          >
            Stav ROI
          </label>
          <select
            id="filter-status"
            name="status"
            defaultValue={statusFilter}
            className="h-10 rounded-lg border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
        >
          <Filter className="size-4" />
          Použít
        </button>

        {(supplierId || statusFilter !== "all" || period !== "12") && (
          <Link
            href="/admin/bundles"
            className="inline-flex h-10 items-center rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Zrušit
          </Link>
        )}
      </form>

      {/* ROI cards grid */}
      <Suspense
        fallback={
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-xl border bg-card"
              />
            ))}
          </div>
        }
      >
        <div className="mt-6">
          {visibleCards.length === 0 ? (
            <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                <Package className="size-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">
                Žádné balíky neodpovídají filtru
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Zkus rozšířit období nebo zrušit stav.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleCards.map((b) => (
                <BundleRoiCard key={b.id} bundle={b} />
              ))}
            </div>
          )}
        </div>
      </Suspense>

      {/* 12-month summary strip */}
      <section
        aria-label="Souhrn za posledních 12 měsíců"
        className="mt-8 rounded-xl border bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Souhrn za posledních 12 měsíců
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {yearScope.filter((c) => c.orderDate >= yearAgo).length} balíků
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <SummaryCell label="Investice" value={formatPrice(yearInvested)} />
          <SummaryCell label="Tržby" value={formatPrice(yearRevenue)} />
          <SummaryCell
            label="Zisk"
            value={formatPrice(yearProfit)}
            tone={yearProfit >= 0 ? "good" : "bad"}
          />
          <SummaryCell
            label="Marže"
            value={`${yearMargin.toFixed(0)} %`}
            tone={yearMargin >= 0 ? "good" : "bad"}
          />
          <SummaryCell
            label="Sell-through"
            value={`${yearSellThrough.toFixed(0)} %`}
            sub={`${yearSold}/${yearPieces}`}
          />
        </div>
      </section>
    </>
  );
}

function SummaryCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "bad"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {sub}
        </span>
      )}
    </div>
  );
}
