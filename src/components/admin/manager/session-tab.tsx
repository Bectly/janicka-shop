"use client";

import { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  Cog,
  Coins,
  FileText,
  Clock,
} from "lucide-react";
import { StartSessionForm } from "@/components/admin/manager/start-session-form";
import { ArtifactCard } from "@/components/admin/manager/artifact-card";
import { cn } from "@/lib/utils";

type SessionRow = {
  id: string;
  status: string;
  triggeredBy: string | null;
  startedAt: Date | string;
  endedAt: Date | string | null;
  endReason: string | null;
  summaryMd: string | null;
  costUsd: number;
  tokensTotal: number;
  artifactCount: number;
  artifacts: Array<{
    id: string;
    kind: string;
    title: string | null;
    bodyMd: string | null;
    bodyJson: string | null;
    status: string;
    mood: string | null;
    createdAt: Date | string;
  }>;
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Ve frontě",
  claimed: "Spouští se",
  running: "Běží",
  paused: "Pozastavena",
  done: "Hotovo",
  aborted: "Přerušeno",
  failed: "Selhalo",
};

const STATUS_TINT: Record<string, string> = {
  running: "bg-emerald-500/15 text-emerald-700",
  requested: "bg-amber-500/15 text-amber-700",
  claimed: "bg-amber-500/15 text-amber-700",
  done: "bg-foreground/[0.08] text-muted-foreground",
  failed: "bg-red-500/15 text-red-700",
  aborted: "bg-red-500/15 text-red-700",
  paused: "bg-foreground/[0.08] text-muted-foreground",
};

function formatCest(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(date);
}

export function SessionTab({
  latestSession,
  sessions,
  sessionBusy,
  sessionBusyReason,
}: {
  latestSession: SessionRow | null;
  sessions: SessionRow[];
  sessionBusy: boolean;
  sessionBusyReason?: string;
}) {
  return (
    <div className="space-y-6">
      {/* Start form */}
      <section className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <Sparkles className="size-4 text-primary" />
              Spustit manažerku
            </h2>
            {latestSession ? (
              <p className="mt-1 text-sm text-muted-foreground break-words">
                Poslední:{" "}
                {STATUS_LABEL[latestSession.status] ?? latestSession.status} ·{" "}
                {formatCest(latestSession.startedAt)}
                {latestSession.endedAt
                  ? ` → ${formatCest(latestSession.endedAt)}`
                  : ""}
                {latestSession.costUsd > 0 && (
                  <> · ${latestSession.costUsd.toFixed(2)}</>
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground italic">
                Ještě žádná session. Spusť první níže.
              </p>
            )}
          </div>
          {latestSession && (
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                STATUS_TINT[latestSession.status] ?? "bg-foreground/[0.08] text-muted-foreground",
              )}
            >
              {STATUS_LABEL[latestSession.status] ?? latestSession.status}
            </span>
          )}
        </div>

        <StartSessionForm
          disabled={sessionBusy}
          disabledReason={sessionBusyReason}
        />

        {latestSession?.summaryMd && (
          <details className="rounded-md border bg-background/50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">
              Shrnutí poslední session
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-xs text-foreground/80">
              {latestSession.summaryMd}
            </pre>
          </details>
        )}
      </section>

      {/* Session history */}
      <section className="space-y-3">
        <header>
          <h3 className="flex items-center gap-2 font-heading text-base font-semibold">
            <Cog className="size-4 text-primary" />
            Historie sessions
          </h3>
          <p className="text-xs text-muted-foreground">
            Posledních {sessions.length} běhů. Klikni pro zobrazení artefaktů.
          </p>
        </header>

        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Žádné session v historii.
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <SessionHistoryRow key={s.id} session={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SessionHistoryRow({ session }: { session: SessionRow }) {
  const [open, setOpen] = useState(false);
  const totalCost = session.costUsd > 0 ? `$${session.costUsd.toFixed(2)}` : "—";
  const duration =
    session.endedAt && session.startedAt
      ? formatDuration(
          (typeof session.endedAt === "string"
            ? new Date(session.endedAt).getTime()
            : session.endedAt.getTime()) -
            (typeof session.startedAt === "string"
              ? new Date(session.startedAt).getTime()
              : session.startedAt.getTime()),
        )
      : null;

  return (
    <li className="rounded-lg border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-foreground/[0.03] sm:px-4"
      >
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            STATUS_TINT[session.status] ?? "bg-foreground/[0.08] text-muted-foreground",
          )}
        >
          {STATUS_LABEL[session.status] ?? session.status}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
            <span className="font-medium text-foreground">
              {formatCest(session.startedAt)}
            </span>
            {duration && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {duration}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Coins className="size-3" />
              {totalCost}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="size-3" />
              {session.artifactCount} artefaktů
            </span>
          </div>
          {session.endReason && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {session.endReason}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t px-3 py-3 sm:px-4 space-y-3">
          {session.summaryMd && (
            <pre className="whitespace-pre-wrap break-words rounded-md bg-background/50 p-2 font-sans text-xs text-foreground/80">
              {session.summaryMd}
            </pre>
          )}
          {session.artifacts.length === 0 ? (
            <p className="rounded-md border border-dashed bg-card/40 p-4 text-center text-xs text-muted-foreground">
              Tato session nevyprodukovala žádné artefakty.
            </p>
          ) : (
            <div className="space-y-2 max-w-full">
              {session.artifacts.map((a) => (
                <div key={a.id} className="max-w-full overflow-hidden">
                  <ArtifactCard artifact={a} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
