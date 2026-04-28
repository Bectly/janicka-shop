import Link from "next/link";
import { formatPrice } from "@/lib/format";

export type BundleStatus =
  | "loss"
  | "pending"
  | "profit"
  | "done_profit"
  | "done_loss";

export type BundleRoiData = {
  id: string;
  name: string;
  supplierName: string;
  orderDate: Date;
  totalKg: number;
  totalCost: number;
  revenue: number;
  profit: number;
  marginPct: number;
  sellThroughPct: number;
  avgSellDays: number;
  pieceCount: number;
  soldCount: number;
  staleCount: number;
  status: BundleStatus;
};

const STATUS_BADGE: Record<
  BundleStatus,
  { emoji: string; label: string; className: string; ariaLabel: string }
> = {
  loss: {
    emoji: "🔴",
    label: "Ztrátový",
    className:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
    ariaLabel: "Ztrátový balík",
  },
  pending: {
    emoji: "🟡",
    label: "Break-even pending",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    ariaLabel: "Break-even pending",
  },
  profit: {
    emoji: "🟢",
    label: "Ziskový",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    ariaLabel: "Ziskový balík",
  },
  done_profit: {
    emoji: "✅",
    label: "Vyplatilo se",
    className:
      "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200",
    ariaLabel: "Vyplatilo se — vyprodáno se ziskem",
  },
  done_loss: {
    emoji: "💀",
    label: "Vyprodáno se ztrátou",
    className:
      "bg-rose-100 text-rose-900 ring-1 ring-rose-500/40 dark:bg-rose-900/30 dark:text-rose-200",
    ariaLabel: "Vyprodáno se ztrátou",
  },
};

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

export function BundleRoiCard({ bundle }: { bundle: BundleRoiData }) {
  const badge = STATUS_BADGE[bundle.status];
  const profitClass =
    bundle.profit >= 0
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-destructive";
  const marginClass =
    bundle.marginPct >= 0
      ? "text-foreground"
      : "text-destructive";

  return (
    <Link
      href={`/admin/bundles/${bundle.id}`}
      className="group flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`${bundle.name} — ${badge.ariaLabel}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{bundle.supplierName}</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">
              {formatDay(bundle.orderDate)}
            </span>
          </div>
          <h3 className="mt-1 truncate font-heading text-base font-semibold text-foreground">
            {bundle.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {bundle.totalKg.toLocaleString("cs-CZ", {
              maximumFractionDigits: 1,
            })}{" "}
            kg · {bundle.pieceCount}{" "}
            {bundle.pieceCount === 1 ? "kus" : "kusů"}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
        >
          <span aria-hidden>{badge.emoji}</span>
          <span>{badge.label}</span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Kpi label="Investice" value={formatPrice(bundle.totalCost)} />
        <Kpi label="Tržby" value={formatPrice(bundle.revenue)} />
        <Kpi
          label="Zisk"
          value={formatPrice(bundle.profit)}
          valueClassName={profitClass}
        />
        <Kpi
          label="Marže"
          value={`${bundle.marginPct.toFixed(0)} %`}
          valueClassName={marginClass}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-xs">
        <Stat
          label="Sell-through"
          value={`${bundle.sellThroughPct.toFixed(0)} %`}
          sub={`${bundle.soldCount}/${bundle.pieceCount}`}
        />
        <Stat
          label="Ø prodej"
          value={
            bundle.avgSellDays > 0
              ? `${bundle.avgSellDays.toFixed(0)} d`
              : "—"
          }
        />
        <Stat
          label="Stale"
          value={String(bundle.staleCount)}
          tone={bundle.staleCount > 0 ? "warning" : undefined}
        />
      </div>
    </Link>
  );
}

function Kpi({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums text-foreground ${valueClassName ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warning";
}) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`mt-0.5 font-medium tabular-nums ${tone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[10px] text-muted-foreground">{sub}</span>
      )}
    </div>
  );
}
