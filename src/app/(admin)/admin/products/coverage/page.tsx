import Link from "next/link";
import { connection } from "next/server";
import type { Metadata } from "next";

import { getDb } from "@/lib/db";
import {
  MeasurementQuickEdit,
  type InitialMeasurements,
} from "@/components/admin/measurement-quick-edit";

export const metadata: Metadata = {
  title: "Pokrytí měr",
};

type MeasurementKey = "chest" | "waist" | "hips" | "length" | "sleeve";
type TrackedField = MeasurementKey | "fitNote";

const MEASUREMENT_KEYS: MeasurementKey[] = [
  "chest",
  "waist",
  "hips",
  "length",
  "sleeve",
];
const TRACKED: TrackedField[] = [...MEASUREMENT_KEYS, "fitNote"];

const FIELD_LABELS: Record<TrackedField, string> = {
  chest: "Prsa",
  waist: "Pas",
  hips: "Boky",
  length: "Délka",
  sleeve: "Rukáv",
  fitNote: "Poznámka",
};

function parseMeasurements(raw: string): InitialMeasurements {
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: InitialMeasurements = {};
    for (const key of MEASUREMENT_KEYS) {
      const n = (v as Record<string, unknown>)[key];
      if (typeof n === "number" && isFinite(n) && n > 0) out[key] = n;
    }
    return out;
  } catch {
    return {};
  }
}

type MissingParam = TrackedField | "any" | "all";

function isMissingParam(v: string | undefined): v is MissingParam {
  if (!v) return false;
  return (
    v === "any" || v === "all" || (TRACKED as readonly string[]).includes(v)
  );
}

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ missing?: string; status?: string }>;
}) {
  const params = await searchParams;
  const missingRaw = params.missing;
  const missing: MissingParam = isMissingParam(missingRaw) ? missingRaw : "all";
  const statusFilter = params.status === "all" ? "all" : "active";

  await connection();
  const db = await getDb();

  const products = await db.product.findMany({
    where:
      statusFilter === "active"
        ? { active: true, sold: false }
        : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      brand: true,
      condition: true,
      sold: true,
      active: true,
      measurements: true,
      fitNote: true,
      category: { select: { name: true } },
    },
  });

  type Row = (typeof products)[number] & {
    parsed: InitialMeasurements;
    filled: Record<TrackedField, boolean>;
    filledCount: number;
  };

  const rows: Row[] = products.map((p) => {
    const parsed = parseMeasurements(p.measurements);
    const filled: Record<TrackedField, boolean> = {
      chest: parsed.chest != null,
      waist: parsed.waist != null,
      hips: parsed.hips != null,
      length: parsed.length != null,
      sleeve: parsed.sleeve != null,
      fitNote: !!p.fitNote && p.fitNote.trim() !== "",
    };
    const filledCount = TRACKED.filter((k) => filled[k]).length;
    return { ...p, parsed, filled, filledCount };
  });

  // Aggregate stats across the full scoped set (before row filtering)
  const total = rows.length;
  const fieldCounts: Record<TrackedField, number> = {
    chest: 0,
    waist: 0,
    hips: 0,
    length: 0,
    sleeve: 0,
    fitNote: 0,
  };
  let fullCount = 0;
  for (const r of rows) {
    for (const key of TRACKED) if (r.filled[key]) fieldCounts[key]++;
    if (r.filledCount === TRACKED.length) fullCount++;
  }
  const anyMissingCount = rows.filter((r) => r.filledCount < TRACKED.length).length;
  const noneCount = rows.filter((r) => r.filledCount === 0).length;

  // Row filtering
  const filteredRows = rows.filter((r) => {
    if (missing === "all") return true;
    if (missing === "any") return r.filledCount < TRACKED.length;
    return !r.filled[missing];
  });

  function filterUrl(nextMissing: MissingParam) {
    const p = new URLSearchParams();
    if (nextMissing !== "all") p.set("missing", nextMissing);
    if (statusFilter !== "active") p.set("status", statusFilter);
    const qs = p.toString();
    return `/admin/products/coverage${qs ? `?${qs}` : ""}`;
  }

  function statusUrl(nextStatus: "active" | "all") {
    const p = new URLSearchParams();
    if (missing !== "all") p.set("missing", missing);
    if (nextStatus !== "active") p.set("status", nextStatus);
    const qs = p.toString();
    return `/admin/products/coverage${qs ? `?${qs}` : ""}`;
  }

  const pct = (n: number) =>
    total === 0 ? "0 %" : `${Math.round((n / total) * 100)} %`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Pokrytí měr
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kolik produktů má vyplněné jednotlivé míry a poznámku k střihu.
          </p>
        </div>
        <Link
          href="/admin/products"
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Zpět na produkty
        </Link>
      </div>

      {/* Aggregate stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard
          label="Produktů v rozsahu"
          value={String(total)}
          sub={statusFilter === "active" ? "aktivní, neprodáno" : "všechny"}
        />
        <StatCard
          label="Plně vyplněno"
          value={pct(fullCount)}
          sub={`${fullCount} ks`}
          tone="good"
        />
        <StatCard
          label="Něco chybí"
          value={pct(anyMissingCount)}
          sub={`${anyMissingCount} ks`}
          tone="warn"
        />
        <StatCard
          label="Zcela bez měr"
          value={pct(noneCount)}
          sub={`${noneCount} ks`}
          tone="bad"
        />
        {TRACKED.map((key) => (
          <StatCard
            key={key}
            label={`${FIELD_LABELS[key]} chybí`}
            value={pct(total - fieldCounts[key])}
            sub={`${total - fieldCounts[key]} ks`}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Filtr:
        </span>
        <FilterPill active={missing === "all"} href={filterUrl("all")}>
          Všechny
        </FilterPill>
        <FilterPill active={missing === "any"} href={filterUrl("any")}>
          Cokoliv chybí
        </FilterPill>
        {TRACKED.map((key) => (
          <FilterPill
            key={key}
            active={missing === key}
            href={filterUrl(key)}
          >
            Bez {FIELD_LABELS[key].toLowerCase()}
          </FilterPill>
        ))}
        <span className="mx-1 text-muted-foreground/40">|</span>
        <FilterPill active={statusFilter === "active"} href={statusUrl("active")}>
          Aktivní
        </FilterPill>
        <FilterPill active={statusFilter === "all"} href={statusUrl("all")}>
          Vše
        </FilterPill>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Zobrazuji {filteredRows.length}{" "}
        {filteredRows.length === 1
          ? "produkt"
          : filteredRows.length >= 2 && filteredRows.length <= 4
            ? "produkty"
            : "produktů"}
      </p>

      {/* Rows */}
      <div className="mt-4 space-y-3">
        {filteredRows.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Žádné produkty neodpovídají filtru.
          </div>
        )}
        {filteredRows.map((r) => (
          <div
            key={r.id}
            className="rounded-lg border bg-card p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/admin/products/${r.id}/edit`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {r.name}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{r.sku}</span>
                  {r.brand && <span>· {r.brand}</span>}
                  {r.category?.name && <span>· {r.category.name}</span>}
                  {r.sold && <span className="text-destructive">· prodáno</span>}
                  {!r.active && !r.sold && <span>· skryto</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CoverageBadge filled={r.filledCount} total={TRACKED.length} />
                <div className="hidden gap-1 sm:flex">
                  {TRACKED.map((key) => (
                    <span
                      key={key}
                      title={`${FIELD_LABELS[key]}${r.filled[key] ? "" : " — chybí"}`}
                      className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-medium uppercase ${
                        r.filled[key]
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {FIELD_LABELS[key].slice(0, 3)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <MeasurementQuickEdit
                id={r.id}
                initial={r.parsed}
                initialFitNote={r.fitNote}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-primary"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function FilterPill({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {children}
    </Link>
  );
}

function CoverageBadge({ filled, total }: { filled: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
  const tone =
    pct === 100
      ? "bg-primary/15 text-primary"
      : pct >= 50
        ? "bg-amber-500/15 text-amber-700"
        : "bg-destructive/15 text-destructive";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {filled}/{total} · {pct} %
    </span>
  );
}
