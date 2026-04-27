"use client";

import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatPrice } from "@/lib/format";

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
  grossProfit: number;
  marginPct: number;
};

type MonthRow = {
  month: string;
  bundleCount: number;
  soldCount: number;
  revenue: number;
  grossProfit: number;
  marginPct: number;
};

const MONTH_NAMES_CS = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx > 11) return key;
  return `${MONTH_NAMES_CS[idx]} ${y}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

function marginColor(pct: number): string {
  if (pct >= 50) return "text-emerald-700";
  if (pct >= 20) return "text-foreground";
  if (pct > 0) return "text-amber-700";
  return "text-destructive";
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function ProfitTabs({
  byBundle,
  byCategory,
  byMonth,
}: {
  byBundle: BundleRow[];
  byCategory: CategoryRow[];
  byMonth: MonthRow[];
}) {
  return (
    <Tabs defaultValue="bundle">
      <TabsList className="w-full md:w-auto">
        <TabsTrigger value="bundle">Po balíku</TabsTrigger>
        <TabsTrigger value="category">Po kategorii</TabsTrigger>
        <TabsTrigger value="month">Po měsíci</TabsTrigger>
      </TabsList>

      <TabsContent value="bundle">
        {byBundle.length === 0 ? (
          <EmptyState label="Zatím žádné balíky." />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Balík</th>
                  <th className="px-3 py-2 text-right font-medium">Objednáno</th>
                  <th className="px-3 py-2 text-right font-medium">Náklady</th>
                  <th className="px-3 py-2 text-right font-medium">Kusů prodáno</th>
                  <th className="px-3 py-2 text-right font-medium">Tržby</th>
                  <th className="px-3 py-2 text-right font-medium">Zisk</th>
                  <th className="px-3 py-2 text-right font-medium">Marže %</th>
                </tr>
              </thead>
              <tbody>
                {byBundle.map((b) => (
                  <tr key={b.bundleId} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/bundles/${b.bundleId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {b.bundleName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.pieceCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPrice(b.totalCost)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {b.soldCount} / {b.pieceCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPrice(b.revenue)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        b.grossProfit >= 0 ? "text-foreground" : "text-destructive"
                      }`}
                    >
                      {formatPrice(b.grossProfit)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${marginColor(b.marginPct)}`}
                    >
                      {formatPct(b.marginPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="category">
        {byCategory.length === 0 ? (
          <EmptyState label="Zatím žádná data podle kategorie." />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Kód</th>
                  <th className="px-3 py-2 font-medium">Kategorie</th>
                  <th className="px-3 py-2 text-right font-medium">Kusů prodáno</th>
                  <th className="px-3 py-2 text-right font-medium">Tržby</th>
                  <th className="px-3 py-2 text-right font-medium">Zisk</th>
                  <th className="px-3 py-2 text-right font-medium">Marže %</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => (
                  <tr key={c.code} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.soldCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPrice(c.revenue)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        c.grossProfit >= 0 ? "text-foreground" : "text-destructive"
                      }`}
                    >
                      {formatPrice(c.grossProfit)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${marginColor(c.marginPct)}`}
                    >
                      {formatPct(c.marginPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="month">
        {byMonth.length === 0 ? (
          <EmptyState label="Zatím žádná data podle měsíce." />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Měsíc</th>
                  <th className="px-3 py-2 text-right font-medium">Balíků</th>
                  <th className="px-3 py-2 text-right font-medium">Kusů prodáno</th>
                  <th className="px-3 py-2 text-right font-medium">Tržby</th>
                  <th className="px-3 py-2 text-right font-medium">Zisk</th>
                  <th className="px-3 py-2 text-right font-medium">Marže %</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map((m) => (
                  <tr key={m.month} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{formatMonth(m.month)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.bundleCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.soldCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatPrice(m.revenue)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        m.grossProfit >= 0 ? "text-foreground" : "text-destructive"
                      }`}
                    >
                      {formatPrice(m.grossProfit)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${marginColor(m.marginPct)}`}
                    >
                      {formatPct(m.marginPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
