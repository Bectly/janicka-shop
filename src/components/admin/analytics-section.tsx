"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type {
  TopProduct,
  CategorySale,
  StaleProduct,
  MonthlyRevenue,
} from "@/app/(admin)/admin/dashboard/analytics-data";
import { formatPrice } from "@/lib/format";
import Link from "next/link";
import Image from "next/image";

type AnalyticsWindow = 30 | 90;

const PIE_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#f43f5e", "#f97316", "#eab308", "#22c55e",
];

export function AnalyticsSection({
  topProducts,
  categorySales,
  staleProducts,
  monthlyRevenue,
  analyticsWindow,
}: {
  topProducts: TopProduct[];
  categorySales: CategorySale[];
  staleProducts: StaleProduct[];
  monthlyRevenue: MonthlyRevenue[];
  analyticsWindow: AnalyticsWindow;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setWindow = useCallback(
    (w: AnalyticsWindow) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("aw", String(w));
      router.push(`/admin/dashboard?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="space-y-8 mt-8">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Analytika prodeje
        </h2>
        <div
          className="flex gap-1 rounded-lg border bg-muted/50 p-1"
          role="group"
          aria-label="Analytické okno"
        >
          {([30, 90] as AnalyticsWindow[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              aria-pressed={analyticsWindow === w}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95 ${
                analyticsWindow === w
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w} dní
            </button>
          ))}
        </div>
      </div>

      {/* 12-month revenue line chart */}
      <section>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tržby za 12 měsíců
        </h3>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={monthlyRevenue}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
                tick={{ fontSize: 11 }}
                width={40}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [formatPrice(Number(v)), "Tržby"]}
                labelStyle={{ fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name="Tržby"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top 10 + Category pie */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Top 10 prodávaných — posledních {analyticsWindow} dní
          </h3>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-muted-foreground">
                <BarChart3 className="size-8 opacity-40" />
                <p className="text-sm">Žádná data pro toto období.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Produkt
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      ks
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Tržby
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={p.productId} className="border-b last:border-0 odd:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-4 shrink-0 text-xs font-medium text-muted-foreground">
                            {i + 1}
                          </span>
                          {p.image && (
                            <Image
                              src={p.image}
                              alt={p.name}
                              width={28}
                              height={28}
                              className="size-7 shrink-0 rounded-md object-cover"
                            />
                          )}
                          <Link
                            href={`/admin/products/${p.productId}`}
                            className="max-w-[140px] truncate font-medium text-foreground transition-colors duration-150 hover:text-primary hover:underline"
                          >
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {p.soldCount}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-primary">
                        {formatPrice(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prodej podle kategorií
          </h3>
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border bg-card p-4 shadow-sm">
            {categorySales.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <BarChart3 className="size-8 opacity-40" />
                <p className="text-sm">Žádná data pro toto období.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={categorySales}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.05 ? `${name ?? ""} ${Math.round((percent ?? 0) * 100)}%` : ""
                    }
                    labelLine={false}
                  >
                    {categorySales.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [formatPrice(Number(v)), "Tržby"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* Ležáky */}
      {staleProducts.length > 0 && (
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ležáky — aktivní 60+ dní, 0 objednávek ({staleProducts.length})
          </h3>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                    Produkt
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                    Kategorie
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                    Cena
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                    Přidáno
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {staleProducts.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {p.image && (
                          <Image
                            src={p.image}
                            alt={p.name}
                            width={28}
                            height={28}
                            className="size-7 shrink-0 rounded-md object-cover"
                          />
                        )}
                        <span className="font-medium text-foreground">
                          {p.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {p.categoryName}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold">
                      {formatPrice(p.price)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("cs-CZ", {
                        day: "numeric",
                        month: "numeric",
                        year: "numeric",
                      
          timeZone: "Europe/Prague",
        }).format(p.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/products/${p.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Upravit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
