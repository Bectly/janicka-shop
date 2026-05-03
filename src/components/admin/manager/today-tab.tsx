"use client";

import { Sparkles, MessageSquare, ClipboardList } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { TaskCard } from "@/components/admin/manager/task-card";

type ManagerTaskRow = {
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
  comments?: Array<{
    id: string;
    authorRole: string;
    authorName: string | null;
    bodyMd: string;
    createdAt: Date | string;
  }>;
};

type DailyReport = {
  id: string;
  title: string | null;
  bodyMd: string | null;
  bodyJson: string | null;
  createdAt: Date | string;
} | null;

type LatestManagerMessage = {
  id: string;
  threadId: string;
  threadSubject: string | null;
  preview: string;
  createdAt: Date | string;
} | null;

function formatCest(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(date);
}

function extractBullets(md: string | null, json: string | null): string[] {
  // Prefer JSON payload if it has bullets / highlights
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const candidates = [
        parsed.bullets,
        parsed.highlights,
        parsed.key_points,
        parsed.summary_bullets,
      ];
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) {
          return c
            .map((x) => (typeof x === "string" ? x : ""))
            .filter(Boolean)
            .slice(0, 3);
        }
      }
    } catch {
      // ignore
    }
  }
  if (!md) return [];
  // Pull leading markdown bullets, fallback to first sentences.
  const lines = md.split("\n").map((l) => l.trim());
  const bullets = lines
    .filter((l) => /^([-*+]|\d+\.)\s+/.test(l))
    .map((l) => l.replace(/^([-*+]|\d+\.)\s+/, ""))
    .slice(0, 3);
  if (bullets.length > 0) return bullets;
  const sentences = md
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  return sentences;
}

export function TodayTab({
  actionableTasks,
  todayReport,
  latestManagerMessage,
}: {
  actionableTasks: ManagerTaskRow[];
  todayReport: DailyReport;
  latestManagerMessage: LatestManagerMessage;
}) {
  const reportBullets = todayReport
    ? extractBullets(todayReport.bodyMd, todayReport.bodyJson)
    : [];
  const reportTitle =
    todayReport?.title ||
    (() => {
      if (!todayReport?.bodyJson) return null;
      try {
        const j = JSON.parse(todayReport.bodyJson) as Record<string, unknown>;
        return typeof j.title === "string" ? j.title : null;
      } catch {
        return null;
      }
    })();

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" />
          <h2 className="font-heading text-lg sm:text-xl font-semibold">
            Co máš dneska udělat
          </h2>
        </div>
        {actionableTasks.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Žádné aktivní úkoly. Manažerka momentálně nic nečeká.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {actionableTasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold">
              Dnešní report
            </h2>
          </div>
          {todayReport && (
            <span className="text-xs text-muted-foreground">
              {formatCest(todayReport.createdAt)}
            </span>
          )}
        </div>
        {!todayReport ? (
          <p className="text-sm text-muted-foreground">
            Manažerka dnes ještě report neposlala.
          </p>
        ) : (
          <>
            {reportTitle && (
              <h3 className="font-medium text-sm text-foreground">
                {reportTitle}
              </h3>
            )}
            {reportBullets.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/90">
                {reportBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : todayReport.bodyMd ? (
              <div className="prose prose-sm max-w-none text-foreground/90">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {todayReport.bodyMd}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Report bez obsahu.
              </p>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            <h2 className="font-heading text-lg font-semibold">
              Poslední zpráva od manažerky
            </h2>
          </div>
          {latestManagerMessage && (
            <span className="text-xs text-muted-foreground">
              {formatCest(latestManagerMessage.createdAt)}
            </span>
          )}
        </div>
        {!latestManagerMessage ? (
          <p className="text-sm text-muted-foreground">
            Žádná zpráva. Otevři konverzaci a napiš jí.
          </p>
        ) : (
          <div className="space-y-2">
            {latestManagerMessage.threadSubject && (
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {latestManagerMessage.threadSubject}
              </div>
            )}
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">
              {latestManagerMessage.preview}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
