"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Lock,
  Pause,
} from "lucide-react";
import {
  markDevloopTaskBlockedAction,
  markDevloopTaskCompletedAction,
} from "@/app/(admin)/admin/manager/actions";

export type DevloopTaskCardProps = {
  task: {
    id: number;
    tag: string;
    title: string;
    description: string | null;
    status: string;
    blockedReason: string | null;
    createdBy: string | null;
    createdAt: string;
    sourceHumanTaskId: number | null;
    janickaOwned: boolean;
  };
};

const TAG_COLORS: Record<string, string> = {
  BOLT: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  TRACE: "bg-purple-500/15 text-purple-700 border-purple-500/30",
  LEAD: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  SAGE: "bg-pink-500/15 text-pink-700 border-pink-500/30",
  GUARD: "bg-red-500/15 text-red-700 border-red-500/30",
  ARIA: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  BECTLY: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Otevřený",
  blocked: "Blokováno",
  in_progress: "V práci",
  done: "Hotovo",
};

function formatCest(d: string | null): string {
  if (!d) return "—";
  // SQLite timestamps come without timezone — interpret as UTC.
  const isoish = d.includes("T") ? d : d.replace(" ", "T") + "Z";
  const date = new Date(isoish);
  if (Number.isNaN(date.getTime())) return d;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(date);
}

export function DevloopTaskCard({ task }: DevloopTaskCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showBlockInput, setShowBlockInput] = useState(false);

  const tagClass =
    TAG_COLORS[task.tag.toUpperCase()] ??
    "bg-foreground/[0.06] text-muted-foreground border-foreground/10";

  const statusBadge =
    task.status === "blocked"
      ? "bg-amber-500/15 text-amber-700"
      : "bg-emerald-500/15 text-emerald-700";

  const handleComplete = () => {
    setError(null);
    startTransition(async () => {
      const r = await markDevloopTaskCompletedAction(task.id);
      if (!r.ok) setError(r.error ?? "Chyba");
    });
  };

  const handleBlock = () => {
    setError(null);
    if (!blockReason.trim()) {
      setError("Napiš důvod blokace");
      return;
    }
    startTransition(async () => {
      const r = await markDevloopTaskBlockedAction(task.id, blockReason);
      if (!r.ok) setError(r.error ?? "Chyba");
      else {
        setBlockReason("");
        setShowBlockInput(false);
      }
    });
  };

  const scrollToShopTask = () => {
    if (task.sourceHumanTaskId === null) return;
    if (typeof document === "undefined") return;
    const el = document.querySelector(
      `[data-shop-task-id="${task.sourceHumanTaskId}"]`,
    );
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="rounded-lg border border-foreground/15 bg-card p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tagClass}`}
          >
            <Bot className="size-3" />
            {task.tag}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadge}`}>
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
          {!task.janickaOwned && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Lock className="size-3" /> read-only
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          #{task.id}
        </span>
      </div>

      <h3 className="font-medium text-sm text-foreground leading-snug">
        {task.title}
      </h3>

      {task.sourceHumanTaskId !== null && (
        <button
          type="button"
          onClick={scrollToShopTask}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ChevronRight className="size-3 rotate-180" />
          shop task #{task.sourceHumanTaskId}
        </button>
      )}

      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span>{formatCest(task.createdAt)}</span>
        {task.createdBy && <span>· {task.createdBy}</span>}
      </div>

      {task.description && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? "Skrýt detail" : "Zobrazit detail"}
        </button>
      )}

      {expanded && task.description && (
        <pre className="whitespace-pre-wrap rounded-md bg-background/60 p-2 font-sans text-xs text-foreground/80 max-h-64 overflow-y-auto">
          {task.description}
        </pre>
      )}

      {task.status === "blocked" && task.blockedReason && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700">
          <span className="font-medium">Důvod: </span>
          {task.blockedReason}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1 rounded-md bg-red-500/10 p-1.5 text-xs text-red-600">
          <AlertCircle className="size-3 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {task.janickaOwned && (
        <div className="flex flex-wrap gap-1 pt-1 border-t">
          <button
            type="button"
            disabled={isPending}
            onClick={handleComplete}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <CheckCircle2 className="size-3" /> Hotovo
          </button>
          {task.status !== "blocked" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowBlockInput((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-50"
            >
              <Pause className="size-3" /> Blokovat
            </button>
          )}
        </div>
      )}

      {showBlockInput && task.janickaOwned && (
        <div className="space-y-1">
          <textarea
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Proč je task blokovaný?"
            rows={2}
            className="w-full rounded-md border bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={handleBlock}
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Potvrdit blokaci
          </button>
        </div>
      )}
    </div>
  );
}
