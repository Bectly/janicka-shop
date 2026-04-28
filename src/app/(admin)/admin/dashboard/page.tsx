import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { connection } from "next/server";
import {
  getTopProducts,
  getCategorySales,
  getStaleProducts,
  getMonthlyRevenue,
} from "./analytics-data";
import { AnalyticsSection } from "@/components/admin/analytics-section-lazy";

import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  CONDITION_LABELS,
  CONDITION_COLORS,
} from "@/lib/constants";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Images,
  Ruler,
  AlertTriangle,
  Video,
  Shirt,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { PeriodSelector } from "./period-selector";
import { EnvHealthBanner } from "@/components/admin/env-health-banner";
import { PhotoAddCTA } from "@/components/admin/photo-add-cta";

export const metadata: Metadata = {
  title: "Přehled",
};

type Period = "today" | "7d" | "30d" | "all";

function getPeriodDate(period: Period): Date | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (period === "7d") {
    now.setDate(now.getDate() - 7);
    return now;
  }
  // 30d
  now.setDate(now.getDate() - 30);
  return now;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Dnes",
  "7d": "7 dní",
  "30d": "30 dní",
  all: "Celkem",
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; aw?: string }>;
}) {
  await connection();
  const db = await getDb();
  const params = await searchParams;
  const period = (["today", "7d", "30d", "all"].includes(params.period ?? "")
    ? params.period
    : "all") as Period;
  const sinceDate = getPeriodDate(period);
  const analyticsWindow = params.aw === "90" ? 90 : 30;
  const periodLabel = PERIOD_LABELS[period];

  // Date filter for orders/products (null = no filter = all time)
  const dateFilter = sinceDate ? { gte: sinceDate } : undefined;

  const [
    topProducts,
    categorySales,
    staleProducts,
    monthlyRevenue,
    totalProducts,
    activeProducts,
    soldProducts,
    totalOrders,
    totalCustomers,
    recentProducts,
    recentOrders,
    revenueAgg,
    statusGroups,
    coverageProducts,
  ] = await Promise.all([
    getTopProducts(analyticsWindow as 30 | 90),
    getCategorySales(analyticsWindow as 30 | 90),
    getStaleProducts(),
    getMonthlyRevenue(),
    db.product.count(dateFilter ? { where: { createdAt: dateFilter } } : undefined),
    db.product.count({ where: { active: true, sold: false, ...(dateFilter ? { createdAt: dateFilter } : {}) } }),
    db.product.count({ where: { sold: true, ...(dateFilter ? { updatedAt: dateFilter } : {}) } }),
    db.order.count(dateFilter ? { where: { createdAt: dateFilter } } : undefined),
    db.customer.count(dateFilter ? { where: { createdAt: dateFilter } } : undefined),
    db.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { category: { select: { name: true } } },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    db.order.aggregate({
      where: { status: { not: "cancelled" }, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      _sum: { total: true },
    }),
    db.order.groupBy({
      by: ["status"],
      _count: { status: true },
      ...(dateFilter ? { where: { createdAt: dateFilter } } : {}),
    }),
    // Coverage stats — across ALL active unsold products (not period-filtered).
    // Threshold logic requires parsing JSON strings → fetch minimal fields and filter in JS.
    db.product.findMany({
      where: { active: true, sold: false },
      select: {
        images: true,
        measurements: true,
        defectsNote: true,
        videoUrl: true,
        condition: true,
        fitNote: true,
      },
    }),
  ]);

  // Coverage counts with proper thresholds
  const NEW_CONDITIONS = new Set(["new_with_tags", "new_without_tags"]);
  const coverageTotal = coverageProducts.length;
  let coverageWithImages = 0; // 4+ images (Baymard mobile PDP minimum)
  let coverageWithMeasurements = 0; // has both chest AND length
  let coverageWithVideo = 0;
  let coverageWithFitNote = 0;
  let coverageNonNewTotal = 0; // denominator for defects (new items don't need defects)
  let coverageWithDefects = 0; // non-new items with defectsNote populated
  const conditionCounts: Record<string, number> = {};

  for (const p of coverageProducts) {
    try {
      const imgs = JSON.parse(p.images) as unknown;
      if (Array.isArray(imgs) && imgs.length >= 4) coverageWithImages++;
    } catch {}
    try {
      const m = JSON.parse(p.measurements) as Record<string, unknown>;
      const chest = m?.chest;
      const length = m?.length;
      if (
        (typeof chest === "number" || (typeof chest === "string" && chest.trim() !== "")) &&
        (typeof length === "number" || (typeof length === "string" && length.trim() !== ""))
      ) {
        coverageWithMeasurements++;
      }
    } catch {}
    if (p.videoUrl && p.videoUrl.trim() !== "") coverageWithVideo++;
    if (p.fitNote && p.fitNote.trim() !== "") coverageWithFitNote++;
    if (!NEW_CONDITIONS.has(p.condition)) {
      coverageNonNewTotal++;
      if (p.defectsNote && p.defectsNote.trim() !== "") coverageWithDefects++;
    }
    conditionCounts[p.condition] = (conditionCounts[p.condition] ?? 0) + 1;
  }

  // Sorted condition entries by count desc, using defined order as tiebreaker
  const CONDITION_ORDER = ["new_with_tags", "new_without_tags", "excellent", "good", "visible_wear"];
  const conditionEntries = Object.entries(conditionCounts).sort(
    ([a, ca], [b, cb]) => cb - ca || CONDITION_ORDER.indexOf(a) - CONDITION_ORDER.indexOf(b)
  );

  const totalRevenue = revenueAgg._sum.total ?? 0;

  const ordersByStatus: Record<string, number> = {};
  for (const g of statusGroups) {
    ordersByStatus[g.status] = g._count.status;
  }

  const stats = [
    {
      label: period === "all" ? "Tržby celkem" : `Tržby — ${periodLabel}`,
      value: formatPrice(totalRevenue),
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Aktivní (k prodeji)",
      value: activeProducts.toString(),
      icon: TrendingUp,
      color: "text-sky-600 bg-sky-100",
    },
    {
      label: period === "all" ? "Prodáno" : `Prodáno — ${periodLabel}`,
      value: soldProducts.toString(),
      icon: CheckCircle,
      color: "text-violet-600 bg-violet-100",
    },
    {
      label: period === "all" ? "Produkty celkem" : `Nové produkty — ${periodLabel}`,
      value: totalProducts.toString(),
      icon: Package,
      color: "text-slate-600 bg-slate-100",
    },
    {
      label: period === "all" ? "Objednávky" : `Objednávky — ${periodLabel}`,
      value: totalOrders.toString(),
      icon: ShoppingCart,
      color: "text-primary bg-primary/10",
    },
    {
      label: period === "all" ? "Zákazníci" : `Noví zákazníci — ${periodLabel}`,
      value: totalCustomers.toString(),
      icon: Users,
      color: "text-amber-600 bg-amber-100",
    },
  ];

  return (
    <>
      <EnvHealthBanner />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Přehled
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vítej zpět, Janičko!
          </p>
        </div>
        <PeriodSelector activePeriod={period} />
      </div>

      {/* J14 — pink hero CTA: prominent entry to mobile add flow */}
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <PhotoAddCTA />
        <Link
          href="/admin/scan"
          aria-label="Skenovat štítek"
          className="group flex min-h-[120px] items-center gap-3 rounded-2xl border bg-card p-5 text-foreground shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.98] sm:min-h-24 sm:flex-col sm:items-start sm:justify-center sm:px-6"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ScanLine className="size-6 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight">
              Skenovat štítek
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Otevři produkt podle QR
            </p>
          </div>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-5 shadow-sm transition-all duration-150 hover:shadow-md hover:border-primary/30"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.color}`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product coverage panel */}
      {coverageTotal > 0 && (
        <section className="mt-8">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Kvalita katalogu
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Aktivních produktů: {coverageTotal} — jak úplné jsou informace
            </p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {(
              [
                {
                  label: "Fotografie",
                  icon: Images,
                  count: coverageWithImages,
                  total: coverageTotal,
                  hint: "cíl: 4+ fotek na mobilu (Baymard)",
                  missing: "images",
                },
                {
                  label: "Míry",
                  icon: Ruler,
                  count: coverageWithMeasurements,
                  total: coverageTotal,
                  hint: "min. hruď + délka",
                  missing: "measurements",
                },
                {
                  label: "Závady",
                  icon: AlertTriangle,
                  count: coverageWithDefects,
                  total: coverageNonNewTotal,
                  hint: "z použitých kusů – upřímnost buduje důvěru",
                  missing: "defects",
                },
                {
                  label: "Video",
                  icon: Video,
                  count: coverageWithVideo,
                  total: coverageTotal,
                  hint: "+65 % konverze s videem",
                  missing: "video",
                },
                {
                  label: "Poznámka k střihu",
                  icon: Shirt,
                  count: coverageWithFitNote,
                  total: coverageTotal,
                  hint: "jak kus sedí a padá",
                  missing: "fitnote",
                },
              ] as const
            ).map(({ label, icon: Icon, count, total, hint, missing }) => {
              const pct =
                total > 0 ? Math.round((count / total) * 100) : 0;
              const barColor =
                pct >= 80
                  ? "bg-emerald-500"
                  : pct >= 50
                    ? "bg-amber-500"
                    : "bg-rose-500";
              const textColor =
                pct >= 80
                  ? "text-emerald-600"
                  : pct >= 50
                    ? "text-amber-600"
                    : "text-rose-600";
              const iconBg =
                pct >= 80
                  ? "bg-emerald-100"
                  : pct >= 50
                    ? "bg-amber-100"
                    : "bg-rose-100";
              const missingCount = Math.max(0, total - count);
              return (
                <Link
                  key={label}
                  href={`/admin/products?missing=${missing}`}
                  className="group rounded-xl border bg-card p-4 shadow-sm transition-all duration-150 hover:border-primary/50 hover:bg-muted/30 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className={`rounded-lg p-2 ${iconBg}`}>
                      <Icon className={`size-4 ${textColor}`} />
                    </div>
                    <span className={`text-2xl font-bold ${textColor}`}>
                      {pct}%
                    </span>
                  </div>
                  <p className="mt-3 font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} / {total} produktů
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
                  {missingCount > 0 && (
                    <p className="mt-1 text-xs font-medium text-primary group-hover:underline">
                      Zobrazit {missingCount} k doplnění →
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Condition distribution */}
      {coverageTotal > 0 && conditionEntries.length > 0 && (
        <section className="mt-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Stav zboží v katalogu
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Rozložení aktivních produktů podle stavu
          </p>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="divide-y">
              {conditionEntries.map(([condition, count]) => {
                const pct = Math.round((count / coverageTotal) * 100);
                const label = CONDITION_LABELS[condition] ?? condition;
                const colorClass =
                  CONDITION_COLORS[condition] ?? "bg-muted text-muted-foreground";
                return (
                  <div key={condition} className="flex items-center gap-4 px-4 py-3">
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
                    >
                      {label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/50 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-semibold text-foreground">
                      {count}
                    </span>
                    <span className="w-9 text-right text-xs text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Order status breakdown */}
      {totalOrders > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Stav objednávek
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => {
              const count = ordersByStatus[status] || 0;
              if (count === 0) return null;
              const colorClass =
                ORDER_STATUS_COLORS[status] || "bg-muted text-muted-foreground";
              return (
                <Link
                  key={status}
                  href={`/admin/orders?status=${status}`}
                  className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 shadow-sm transition-colors hover:bg-muted/50"
                >
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                  >
                    {label}
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Recent orders */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Poslední objednávky
            </h2>
            <Link
              href="/admin/orders"
              className="text-sm text-primary hover:underline"
            >
              Zobrazit vše
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            {recentOrders.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Zatím žádné objednávky.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Objednávka
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Zákazník
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Celkem
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Stav
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const statusLabel =
                      ORDER_STATUS_LABELS[order.status] || order.status;
                    const statusColor =
                      ORDER_STATUS_COLORS[order.status] ||
                      "bg-muted text-muted-foreground";
                    return (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(order.createdAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.customer.firstName} {order.customer.lastName}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatPrice(order.total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Recent products */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Naposledy přidané
            </h2>
            <Link
              href="/admin/products"
              className="text-sm text-primary hover:underline"
            >
              Zobrazit vše
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Produkt
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Kategorie
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Cena
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Stav
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.map((product) => (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {product.category.name}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-4 py-3">
                      {product.sold ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Prodáno
                        </span>
                      ) : product.active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Aktivní
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Skryto
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AnalyticsSection
        topProducts={topProducts}
        categorySales={categorySales}
        staleProducts={staleProducts}
        monthlyRevenue={monthlyRevenue}
        analyticsWindow={analyticsWindow as 30 | 90}
      />
    </>
  );
}
