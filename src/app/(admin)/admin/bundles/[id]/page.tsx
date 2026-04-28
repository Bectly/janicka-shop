import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import type { Metadata } from "next";
import {
  ArrowLeft,
  Package,
  PackageOpen,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Clock,
  Tag,
  Printer,
} from "lucide-react";
import { getDb } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import {
  grossProfit,
  marginPct,
  bundleROI,
  conversionRate,
  avgDaysToSell,
} from "@/lib/cost-basis";
import { StatusButtons } from "./status-buttons";
import { BundleRoiChart, type RoiPoint } from "./bundle-roi-chart";

const STALE_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const db = await getDb();
  const bundle = await db.supplierBundle.findUnique({
    where: { id },
    select: {
      invoiceNumber: true,
      orderDate: true,
      supplier: { select: { name: true } },
    },
  });
  if (!bundle) return { title: "Balík" };
  const label = bundle.invoiceNumber ?? formatDay(bundle.orderDate);
  return { title: `${bundle.supplier.name} — ${label}` };
}

async function getBundle(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`admin-bundle:${id}`);

  const db = await getDb();
  return db.supplierBundle.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      lines: {
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          kg: true,
          pricePerKg: true,
          totalPrice: true,
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
}

const STATUS_LABELS: Record<string, string> = {
  ordered: "Objednáno",
  received: "Přijato",
  unpacked: "Rozbaleno",
  done: "Hotovo",
};

const STATUS_COLORS: Record<string, string> = {
  ordered:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  received: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  unpacked:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  
          timeZone: "Europe/Prague",
        }).format(date);
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

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const bundle = await getBundle(id);

  if (!bundle) notFound();

  const status = bundle.status ?? "ordered";
  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.ordered;
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * MS_PER_DAY);

  // Per-product enrichment (sold date + days listed)
  type Enriched = {
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

  const enriched: Enriched[] = bundle.products.map((p) => {
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
      costBasis: p.costBasis ?? null,
      sold: p.sold,
      createdAt: p.createdAt,
      soldAt,
      daysToSell: soldAt ? daysBetween(p.createdAt, soldAt) : null,
      daysOld: daysBetween(p.createdAt, now),
      image: firstImage(p.images),
      bundleLineId: p.bundleLineId,
    };
  });

  // KPIs
  const totalCost = bundle.totalPrice;
  const revenue = enriched
    .filter((p) => p.sold)
    .reduce((acc, p) => acc + p.price, 0);
  const profit = grossProfit(revenue, totalCost);
  const margin = marginPct(revenue, totalCost);
  const roi = bundleROI(revenue, totalCost);
  const pieceCount = enriched.length;
  const soldCount = enriched.filter((p) => p.sold).length;
  const sellThroughPct = conversionRate(soldCount, pieceCount);
  const avgSell = avgDaysToSell(enriched);
  const productsWithCost = enriched.filter((p) => p.costBasis !== null);
  const missingCostCount = enriched.length - productsWithCost.length;

  // Build chart data: cumulative revenue by date.
  const sales = enriched
    .filter((p): p is Enriched & { soldAt: Date } => p.soldAt !== null)
    .sort((a, b) => a.soldAt.getTime() - b.soldAt.getTime());

  const chartData: RoiPoint[] = [];
  let breakEvenDate: string | null = null;
  if (sales.length > 0) {
    chartData.push({
      date: sales[0].soldAt.toISOString().slice(0, 10),
      revenue: 0,
    });
    let cum = 0;
    for (const s of sales) {
      cum += s.price;
      const d = s.soldAt.toISOString().slice(0, 10);
      const last = chartData[chartData.length - 1];
      if (last && last.date === d) {
        last.revenue = cum;
      } else {
        chartData.push({ date: d, revenue: cum });
      }
      if (!breakEvenDate && totalCost > 0 && cum >= totalCost) {
        breakEvenDate = d;
      }
    }
    // Add a "today" point so the area extends to current state.
    const todayStr = now.toISOString().slice(0, 10);
    if (chartData[chartData.length - 1].date !== todayStr) {
      chartData.push({ date: todayStr, revenue: cum });
    }
  }
  const breakEvenReached = totalCost > 0 && revenue >= totalCost;

  // Per-line aggregation
  type LineAgg = {
    id: string;
    code: string;
    name: string;
    pieces: number;
    sold: number;
    revenue: number;
    sellThroughPct: number;
    avgSellDays: number;
  };
  const linesAgg: LineAgg[] = bundle.lines.map((line) => {
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

  // Best / worst sellers
  const bestSellers = enriched
    .filter((p) => p.sold && p.daysToSell !== null)
    .sort((a, b) => (a.daysToSell ?? 0) - (b.daysToSell ?? 0))
    .slice(0, 3);
  const worstStock = enriched
    .filter((p) => !p.sold)
    .sort((a, b) => b.daysOld - a.daysOld)
    .slice(0, 3);

  // Stale grid: unsold >30d
  const stale = enriched
    .filter((p) => !p.sold && p.createdAt < staleCutoff)
    .sort((a, b) => b.daysOld - a.daysOld);

  // Insight: which lines yielded best ROI signal — high sell-through + fast turnover.
  const insightLines = [...linesAgg]
    .filter((l) => l.pieces >= 2)
    .sort((a, b) => {
      // Higher sell-through wins; tiebreaker = faster avg sell.
      if (b.sellThroughPct !== a.sellThroughPct)
        return b.sellThroughPct - a.sellThroughPct;
      const ad = a.avgSellDays || Number.POSITIVE_INFINITY;
      const bd = b.avgSellDays || Number.POSITIVE_INFINITY;
      return ad - bd;
    });
  const topInsight = insightLines.slice(0, 2);
  const avoidInsight = insightLines
    .filter((l) => l.sellThroughPct < 30 || (l.sold === 0 && l.pieces > 0))
    .slice(-2);

  const canUnpack = status === "received" || status === "unpacked";

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/admin/suppliers/${bundle.supplier.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {bundle.supplier.name}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {bundle.invoiceNumber
                ? bundle.invoiceNumber
                : `Balík ${formatDay(bundle.orderDate)}`}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusColor}`}
            >
              {statusLabel}
            </span>
            {breakEvenReached ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-500/30 dark:bg-emerald-900/30 dark:text-emerald-300">
                <span aria-hidden>✅</span> Break-even dosažen
              </span>
            ) : revenue > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <span aria-hidden>🟡</span>
                {(() => {
                  const remaining = totalCost - revenue;
                  return `Do break-even chybí ${formatPrice(remaining)}`;
                })()}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              {bundle.totalKg.toLocaleString("cs-CZ", {
                maximumFractionDigits: 2,
              })}{" "}
              kg
            </span>
            <span>{formatPrice(bundle.totalPrice)}</span>
            <span>Objednáno: {formatDay(bundle.orderDate)}</span>
            {bundle.receivedDate && (
              <span>Přijato: {formatDay(bundle.receivedDate)}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUnpack && (
            <Link
              href={`/admin/bundles/${id}/unpack`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
            >
              <PackageOpen className="size-4" />
              Rozbalit
            </Link>
          )}
          <Link
            href={`/admin/bundles/${id}/labels`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Printer className="size-4" />
            Tisk štítků
          </Link>
          <StatusButtons bundleId={id} status={status} />
        </div>
      </div>

      {/* KPI strip */}
      <section
        aria-label="Klíčové metriky"
        className="mt-6 rounded-xl border bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          <Kpi label="Investice" value={formatPrice(totalCost)} />
          <Kpi label="Tržby" value={formatPrice(revenue)} />
          <Kpi
            label="Zisk"
            value={formatPrice(profit)}
            tone={profit >= 0 ? "good" : "bad"}
          />
          <Kpi
            label="ROI"
            value={`${roi.toFixed(0)} %`}
            tone={roi >= 0 ? "good" : "bad"}
          />
          <Kpi
            label="Marže"
            value={`${margin.toFixed(0)} %`}
            tone={margin >= 0 ? "good" : "bad"}
          />
          <Kpi
            label="Sell-through"
            value={`${sellThroughPct.toFixed(0)} %`}
            sub={`${soldCount}/${pieceCount}`}
          />
          <Kpi
            label="Ø prodej"
            value={avgSell > 0 ? `${avgSell.toFixed(0)} d` : "—"}
            sub={avgSell > 0 ? "od přijetí" : undefined}
          />
        </div>
      </section>

      {/* Chart */}
      <section
        aria-label="Vývoj tržeb proti nákladu"
        className="mt-6 rounded-xl border bg-card p-5 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Kumulativní tržby vs. náklad
          </h2>
          {breakEvenReached && (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              Investice se vrátila
            </span>
          )}
        </div>
        <BundleRoiChart
          data={chartData}
          totalCost={totalCost}
          breakEvenDate={breakEvenDate}
        />
      </section>

      {/* Insights */}
      {(topInsight.length > 0 || avoidInsight.length > 0) && (
        <section
          aria-label="Co kupovat příště"
          className="mt-6 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-card p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold text-foreground">
              Co kupovat příště?
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {topInsight.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="size-3.5" />
                  Vyplatilo se
                </div>
                <ul className="space-y-1.5 text-sm">
                  {topInsight.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {l.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {l.sellThroughPct.toFixed(0)} %
                        {l.avgSellDays > 0
                          ? ` · ${l.avgSellDays.toFixed(0)} d`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {avoidInsight.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-rose-700 dark:text-rose-400">
                  <TrendingDown className="size-3.5" />
                  Příště míň
                </div>
                <ul className="space-y-1.5 text-sm">
                  {avoidInsight.map((l) => (
                    <li
                      key={l.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {l.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {l.sellThroughPct.toFixed(0)} % · {l.sold}/{l.pieces}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Best / worst sellers */}
      {(bestSellers.length > 0 || worstStock.length > 0) && (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <SellerPanel
            title="Nejrychleji prodáno"
            icon={<TrendingUp className="size-4 text-emerald-700" />}
            tone="good"
            empty="Zatím nic prodáno."
            items={bestSellers.map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              price: p.price,
              image: p.image,
              meta:
                p.daysToSell !== null
                  ? `${p.daysToSell} ${p.daysToSell === 1 ? "den" : p.daysToSell >= 2 && p.daysToSell <= 4 ? "dny" : "dní"}`
                  : "—",
            }))}
          />
          <SellerPanel
            title="Nejdéle ve skladu"
            icon={<Clock className="size-4 text-amber-700" />}
            tone="warning"
            empty="Vše prodané — paráda."
            items={worstStock.map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              price: p.price,
              image: p.image,
              meta: `${p.daysOld} dní`,
            }))}
          />
        </section>
      )}

      {/* Category table */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Kategorie
          </h2>
          <span className="text-sm text-muted-foreground">
            {linesAgg.length}
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {linesAgg.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                <Package className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Žádné kategorie
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kategorie se přidají při importu ceníku.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Kód
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Název
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Kusů
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Prodáno
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Sell-through
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Ø prodej
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Tržby
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linesAgg.map((line) => (
                    <tr
                      key={line.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {line.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {line.name}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {line.pieces}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {line.sold}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <SellThroughCell value={line.sellThroughPct} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {line.avgSellDays > 0
                          ? `${line.avgSellDays.toFixed(0)} d`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatPrice(line.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Stale grid */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Stojí ve skladu &gt; {STALE_DAYS} dní
          </h2>
          <span className="text-sm text-muted-foreground">{stale.length}</span>
        </div>
        {missingCostCount > 0 && (
          <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/50 dark:bg-amber-900/20">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-800 dark:text-amber-300">
              {missingCostCount === 1
                ? "1 kus nemá"
                : `${missingCostCount} kusů nemá`}{" "}
              vyplněnou nákladovou cenu — zisk a ROI nejsou přesné.
            </span>
          </div>
        )}
        {stale.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Package className="size-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Žádný kus nestojí ve skladu déle než {STALE_DAYS} dní.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {stale.map((p) => {
              const suggested = Math.max(
                Math.round(p.price * 0.85),
                p.costBasis ? Math.round(p.costBasis * 1.1) : 0,
              );
              return (
                <article
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
                >
                  <Link
                    href={`/admin/products/${p.id}/edit`}
                    className="relative aspect-square overflow-hidden bg-muted"
                  >
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="size-8 text-muted-foreground" />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-500/30 dark:bg-amber-900/70 dark:text-amber-100">
                      <Clock className="size-3" />
                      {p.daysOld} dní
                    </span>
                  </Link>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/products/${p.id}/edit`}
                        className="block truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                        <span className="font-mono truncate">{p.sku}</span>
                        <span className="font-semibold text-foreground">
                          {formatPrice(p.price)}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/admin/products/${p.id}/edit?suggestPrice=${suggested}`}
                      className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/20 active:scale-95"
                    >
                      <Tag className="size-3.5" />
                      Doporučit cenu {formatPrice(suggested)}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function Kpi({
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
      <span className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>
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

function SellThroughCell({ value }: { value: number }) {
  const tone =
    value >= 70
      ? "text-emerald-700 dark:text-emerald-400"
      : value >= 40
        ? "text-amber-700 dark:text-amber-400"
        : value > 0
          ? "text-rose-700 dark:text-rose-400"
          : "text-muted-foreground";
  return <span className={`font-medium ${tone}`}>{value.toFixed(0)} %</span>;
}

function SellerPanel({
  title,
  icon,
  tone,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "good" | "warning";
  empty: string;
  items: {
    id: string;
    name: string;
    sku: string;
    price: number;
    image: string | null;
    meta: string;
  }[];
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="font-heading text-sm font-semibold text-foreground">
          {title}
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/products/${p.id}/edit`}
                className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted/50"
              >
                <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatPrice(p.price)} · {p.meta}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium tabular-nums ${
                    tone === "good"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {p.meta}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
