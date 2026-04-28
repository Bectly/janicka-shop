"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/lib/format";

export type RoiPoint = {
  /** ISO date string */
  date: string;
  /** Cumulative revenue from sold pieces up to this date */
  revenue: number;
};

export function BundleRoiChart({
  data,
  totalCost,
  breakEvenDate,
}: {
  data: RoiPoint[];
  totalCost: number;
  breakEvenDate: string | null;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Zatím žádné prodeje — graf se zobrazí po prvním prodaném kousku.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="roi-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tickFormatter={formatTick}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompact(v)}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={56}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label) =>
              typeof label === "string" ? formatTooltipDate(label) : ""
            }
            formatter={(value) => [
              formatPrice(typeof value === "number" ? value : Number(value) || 0),
              "Tržby",
            ]}
          />
          <ReferenceLine
            y={totalCost}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{
              value: `Náklad ${formatPrice(totalCost)}`,
              position: "insideTopRight",
              fill: "#ef4444",
              fontSize: 11,
            }}
          />
          {breakEvenDate && (
            <ReferenceLine
              x={breakEvenDate}
              stroke="#10b981"
              strokeDasharray="3 3"
              label={{
                value: "Break-even",
                position: "top",
                fill: "#10b981",
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#roi-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatTick(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
  
          timeZone: "Europe/Prague",
        }).format(d);
}

function formatTooltipDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  
          timeZone: "Europe/Prague",
        }).format(d);
}

function formatCompact(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}
