"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Calendar, Tag, AlertCircle, CheckCircle2, XCircle, Pause, Play } from "lucide-react";
import { changeTaskStatusAction } from "@/app/(admin)/admin/manager/actions";
import { CommentThread } from "@/components/admin/manager/comment-thread";

type Comment = {
  id: string;
  authorRole: string;
  authorName: string | null;
  bodyMd: string;
  createdAt: Date | string;
};

type Task = {
  id: string;
  category: string;
  priority: string;
  assigneeHint: string | null;
  title: string;
  descriptionMd: string;
  rationaleMd: string | null;
  expectedOutcome: string | null;
  dueAt: Date | null;
  status: string;
  createdAt: Date;
  comments?: Comment[];
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "border-red-500/40 bg-red-500/5",
  high: "border-amber-500/40 bg-amber-500/5",
  medium: "border-foreground/20 bg-foreground/[0.02]",
  low: "border-muted-foreground/20 bg-transparent",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "🔴 Urgent",
  high: "🟠 High",
  medium: "Medium",
  low: "Low",
};

const CATEGORY_LABELS: Record<string, string> = {
  sales: "Prodej",
  marketing: "Marketing",
  tech: "Technika",
  analytics: "Analýzy",
  people: "Tým",
  strategy: "Strategie",
  admin: "Admin",
  other: "Jiné",
};

function formatCest(d: Date | null | string): string {
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

function daysUntil(d: Date | null | string): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function TaskCard({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const dueDays = daysUntil(task.dueAt);
  const dueColor =
    dueDays === null
      ? "text-muted-foreground"
      : dueDays < 0
        ? "text-red-600 font-semibold"
        : dueDays <= 2
          ? "text-amber-600 font-semibold"
          : "text-muted-foreground";

  const handle = (newStatus: string) => {
    startTransition(async () => {
      const r = await changeTaskStatusAction(task.id, newStatus);
      if (!r.ok) setError(r.error ?? "Chyba");
    });
  };

  return (
    <div
      className={`rounded-lg border p-3 shadow-sm space-y-2 ${PRIORITY_STYLES[task.priority] ?? "border-foreground/20"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm text-foreground leading-tight">
          {task.title}
        </h3>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
          {PRIORITY_LABELS[task.priority] ?? task.priority}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-md bg-foreground/[0.04] px-1.5 py-0.5">
          <Tag className="size-3" />
          {CATEGORY_LABELS[task.category] ?? task.category}
        </span>
        {task.dueAt && (
          <span className={`inline-flex items-center gap-1 ${dueColor}`}>
            <Calendar className="size-3" />
            {formatCest(task.dueAt)}
            {dueDays !== null && (
              <span className="ml-0.5 opacity-80">
                ({dueDays < 0 ? `prošlo ${-dueDays}d` : dueDays === 0 ? "dnes" : `${dueDays}d`})
              </span>
            )}
          </span>
        )}
        {task.assigneeHint && (
          <span className="text-xs text-muted-foreground/80">
            → {task.assigneeHint}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-primary hover:underline"
      >
        {expanded ? "Skrýt detail" : "Zobrazit detail"}
      </button>

      {expanded && (
        <div className="space-y-2 rounded-md bg-background/50 p-2 text-xs">
          <div className="prose prose-sm max-w-none text-foreground/90">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {task.descriptionMd}
            </ReactMarkdown>
          </div>
          {task.rationaleMd && (
            <details className="border-t pt-2">
              <summary className="cursor-pointer text-muted-foreground">
                Proč to dělat
              </summary>
              <div className="prose prose-sm max-w-none mt-1 text-foreground/80">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {task.rationaleMd}
                </ReactMarkdown>
              </div>
            </details>
          )}
          {task.expectedOutcome && (
            <div className="border-t pt-2">
              <span className="text-muted-foreground">Cíl: </span>
              <span className="text-foreground/80">{task.expectedOutcome}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1 rounded-md bg-red-500/10 p-1.5 text-xs text-red-600">
          <AlertCircle className="size-3 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1 pt-1 border-t">
        {task.status === "open" && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handle("accepted")}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Play className="size-3" /> Přijmout
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handle("rejected")}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-50"
            >
              <XCircle className="size-3" /> Zamítnout
            </button>
          </>
        )}
        {task.status === "accepted" && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handle("in_progress")}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Začít pracovat
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handle("blocked")}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-50"
            >
              <Pause className="size-3" /> Blokováno
            </button>
          </>
        )}
        {task.status === "in_progress" && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handle("done")}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="size-3" /> Hotovo
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handle("blocked")}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-50"
            >
              <Pause className="size-3" /> Blokováno
            </button>
          </>
        )}
        {task.status === "blocked" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handle("in_progress")}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="size-3" /> Pokračovat
          </button>
        )}
        {(task.status === "done" || task.status === "rejected") && (
          <span className="text-xs text-muted-foreground">
            {task.status === "done" ? "✓ Hotovo" : "✕ Zamítnuto"}
          </span>
        )}
      </div>

      <CommentThread
        parentType="task"
        parentId={task.id}
        comments={task.comments ?? []}
      />
    </div>
  );
}
