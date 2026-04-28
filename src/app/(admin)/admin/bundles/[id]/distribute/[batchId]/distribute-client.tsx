"use client";

import { useMemo, useState, useTransition } from "react";

import { saveDistribution } from "./actions";

export interface DraftRow {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  weightG: number;
  costBasis: number | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  estimateG: number;
}

type Mode = "weight" | "equal";

interface Props {
  bundleId: string;
  batchId: string;
  totalCost: number;
  drafts: DraftRow[];
  categories: CategoryRow[];
}

function formatPrice(czk: number): string {
  return `${Math.round(czk).toLocaleString("cs-CZ")} Kč`;
}

export function DistributeClient({
  bundleId,
  batchId,
  totalCost: initialTotalCost,
  drafts: initialDrafts,
  categories,
}: Props) {
  const [mode, setMode] = useState<Mode>("weight");
  const [pieceCount, setPieceCount] = useState<number>(initialDrafts.length || 1);
  const [totalCost, setTotalCost] = useState<number>(initialTotalCost);
  const [rows, setRows] = useState<DraftRow[]>(initialDrafts);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalWeight = useMemo(
    () => rows.reduce((acc, r) => acc + (r.weightG || 0), 0),
    [rows],
  );

  const computedRows = useMemo(() => {
    if (rows.length === 0) return rows;
    if (mode === "equal") {
      const per = pieceCount > 0 ? totalCost / pieceCount : 0;
      return rows.map((r) => ({ ...r, costBasis: per }));
    }
    if (totalWeight <= 0) return rows.map((r) => ({ ...r, costBasis: 0 }));
    return rows.map((r) => ({
      ...r,
      costBasis: totalCost * ((r.weightG || 0) / totalWeight),
    }));
  }, [rows, mode, totalCost, totalWeight, pieceCount]);

  function setWeight(id: string, value: number) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, weightG: Math.max(0, value || 0) } : r)),
    );
  }

  function autoFromCategories() {
    setRows((prev) =>
      prev.map((r) => {
        const cat = categories.find((c) => c.id === r.categoryId);
        return { ...r, weightG: cat?.estimateG ?? r.weightG };
      }),
    );
  }

  function handleSave() {
    setError(null);
    const items = computedRows.map((r) => ({
      draftId: r.id,
      weightG: mode === "weight" ? (r.weightG || null) : null,
      costBasis: r.costBasis,
    }));
    startTransition(async () => {
      try {
        await saveDistribution({ bundleId, batchId, items });
        setSavedAt(new Date());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Uložení selhalo");
      }
    });
  }

  const distributedSum = computedRows.reduce((acc, r) => acc + (r.costBasis ?? 0), 0);
  const drift = distributedSum - totalCost;

  return (
    <section className="mt-8 space-y-6">
      {/* Header KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Celková cena balíku">
          <input
            type="number"
            min={0}
            step={1}
            value={Number.isFinite(totalCost) ? totalCost : 0}
            onChange={(e) => setTotalCost(Number(e.target.value) || 0)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card label="Počet kousků">
          <input
            type="number"
            min={1}
            step={1}
            value={pieceCount}
            onChange={(e) => setPieceCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-full rounded-lg border bg-background px-3 py-2 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Card>

        <Card label="Průměr / kus">
          <p className="text-lg font-semibold text-foreground">
            {pieceCount > 0 ? formatPrice(totalCost / pieceCount) : "—"}
          </p>
        </Card>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border bg-card p-1">
          <button
            type="button"
            onClick={() => setMode("weight")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "weight"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Přesné váhy
          </button>
          <button
            type="button"
            onClick={() => setMode("equal")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "equal"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Rovnoměrné rozdělení
          </button>
        </div>

        {mode === "weight" ? (
          <button
            type="button"
            onClick={autoFromCategories}
            className="rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Auto-doplnit z kategorií
          </button>
        ) : null}
      </div>

      {/* Items table */}
      {rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          V této dávce zatím nejsou žádné kousky.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Kousek</th>
                <th className="px-4 py-2.5">Kategorie</th>
                <th className="px-4 py-2.5 text-right">Váha (g)</th>
                <th className="px-4 py-2.5 text-right">Náklad / kus</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {computedRows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.categoryName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {mode === "weight" ? (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={r.weightG}
                        onChange={(e) => setWeight(r.id, Number(e.target.value))}
                        className="w-24 rounded-md border bg-background px-2 py-1 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-foreground">
                    {r.costBasis != null ? formatPrice(r.costBasis) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/20 text-xs text-muted-foreground">
              <tr>
                <td className="px-4 py-2" colSpan={2}>
                  Součet
                </td>
                <td className="px-4 py-2 text-right">
                  {mode === "weight" ? `${totalWeight} g` : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {formatPrice(distributedSum)}
                  {Math.abs(drift) >= 1 ? (
                    <span className="ml-1 text-amber-600">
                      ({drift > 0 ? "+" : ""}
                      {formatPrice(drift)})
                    </span>
                  ) : null}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Save bar */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {savedAt && !error ? (
          <p className="text-sm text-muted-foreground">
            Uloženo {savedAt.toLocaleTimeString("cs-CZ")}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || rows.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
        >
          {pending ? "Ukládám…" : "Uložit rozdělení"}
        </button>
      </div>
    </section>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
