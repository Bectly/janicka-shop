"use client";

import { useMemo, useState } from "react";
import { Inbox, Printer, Filter } from "lucide-react";
import { ArtifactCard } from "@/components/admin/manager/artifact-card";

type ArtifactRow = {
  id: string;
  kind: string;
  title: string | null;
  bodyMd: string | null;
  bodyJson: string | null;
  status: string;
  mood: string | null;
  createdAt: Date | string;
  comments?: Array<{
    id: string;
    authorRole: string;
    authorName: string | null;
    bodyMd: string;
    createdAt: Date | string;
  }>;
};

type KindFilter = "all" | "note" | "chart" | "report" | "task";
type RangeFilter = "7d" | "30d" | "all";

const KIND_OPTIONS: Array<{ key: KindFilter; label: string }> = [
  { key: "all", label: "Vše" },
  { key: "note", label: "Poznámky" },
  { key: "chart", label: "Grafy" },
  { key: "report", label: "Reporty" },
  { key: "task", label: "Úkoly" },
];

const RANGE_OPTIONS: Array<{ key: RangeFilter; label: string }> = [
  { key: "7d", label: "7 dní" },
  { key: "30d", label: "30 dní" },
  { key: "all", label: "Vše" },
];

export function ReportsTab({ artifacts }: { artifacts: ArtifactRow[] }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [range, setRange] = useState<RangeFilter>("30d");

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      range === "7d"
        ? now - 7 * 24 * 60 * 60 * 1000
        : range === "30d"
          ? now - 30 * 24 * 60 * 60 * 1000
          : 0;

    return artifacts.filter((a) => {
      if (kind !== "all") {
        // task family covers task_ai|task_human; report covers report; etc.
        if (kind === "task") {
          if (!a.kind.startsWith("task")) return false;
        } else if (a.kind !== kind) {
          return false;
        }
      }
      if (cutoff > 0) {
        const ts =
          typeof a.createdAt === "string"
            ? new Date(a.createdAt).getTime()
            : a.createdAt.getTime();
        if (ts < cutoff) return false;
      }
      return true;
    });
  }, [artifacts, kind, range]);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 font-heading text-lg sm:text-xl font-semibold">
          <Inbox className="size-5 text-primary" />
          Co manažerka říká
        </h2>
        <p className="text-xs text-muted-foreground">
          Poznámky, grafy, reporty. Filtruj podle druhu nebo data.
        </p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between print:hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="size-3.5" />
            Druh
          </div>
          <div className="flex flex-wrap gap-1">
            {KIND_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setKind(opt.key)}
                aria-pressed={kind === opt.key}
                className={
                  kind === opt.key
                    ? "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-md border px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.04]"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="text-xs font-medium text-muted-foreground">
            Období
          </div>
          <div className="flex flex-wrap gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                aria-pressed={range === opt.key}
                className={
                  range === opt.key
                    ? "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-md border px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.04]"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-foreground/[0.04] sm:ml-auto"
          title="Otevře tiskový dialog (uložit jako PDF)"
        >
          <Printer className="size-3.5" />
          Export PDF
        </button>
      </div>

      <div className="text-xs text-muted-foreground" aria-live="polite">
        {filtered.length === 0
          ? "Žádné výstupy odpovídající filtru."
          : `${filtered.length} ${filtered.length === 1 ? "položka" : filtered.length < 5 ? "položky" : "položek"}`}
      </div>

      {/* Feed */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
          {artifacts.length === 0
            ? "Zatím žádné výstupy. Po manažerské session se tu objeví."
            : "Zkus jiný filtr nebo rozšířit období."}
        </div>
      ) : (
        <div className="space-y-3 max-w-full">
          {filtered.map((a) => (
            <div key={a.id} className="max-w-full overflow-hidden">
              <ArtifactCard
                artifact={{
                  id: a.id,
                  kind: a.kind,
                  title: a.title,
                  bodyMd: a.bodyMd,
                  bodyJson: a.bodyJson,
                  status: a.status,
                  mood: a.mood,
                  createdAt: a.createdAt,
                  comments: a.comments,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
