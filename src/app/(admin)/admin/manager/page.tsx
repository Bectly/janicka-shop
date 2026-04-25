/**
 * Admin Manager page — Janička sees the strategic agent's output.
 *
 * Reads NATIVELY from janicka's own Turso DB via Prisma:
 *  - latest ManagerSession  → status pill + summary preview
 *  - ManagerTask             → kanban (open / accepted+in_progress / blocked / done last 7d)
 *  - ManagerArtifact (note + report + chart, last 10) → workspace feed
 *
 * Plan: ~/.claude/plans/piped-orbiting-fox.md (rewrite — source of truth = project Turso)
 * Manager runner (on bectly's machine) writes here via libsql HTTP pipeline.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { Briefcase, Inbox, Sparkles } from "lucide-react";

import { getDb } from "@/lib/db";
import { ArtifactCard } from "@/components/admin/manager/artifact-card";
import { TaskCard } from "@/components/admin/manager/task-card";

const JANICKA_PROJECT_ID = 15;

export const metadata: Metadata = {
  title: "Manažerka",
};

const STATUS_LABEL: Record<string, string> = {
  running: "Běží",
  paused: "Pozastavena",
  done: "Hotovo",
  aborted: "Přerušeno",
  failed: "Selhalo",
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

export default async function AdminManagerPage() {
  await connection();

  const prisma = await getDb();
  const [latestSession, tasksRaw, artifacts] = await Promise.all([
    prisma.managerSession.findFirst({
      where: { projectId: JANICKA_PROJECT_ID },
      orderBy: { startedAt: "desc" },
    }),
    prisma.managerTask.findMany({
      where: { projectId: JANICKA_PROJECT_ID },
      orderBy: [{ priority: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.managerArtifact.findMany({
      where: {
        projectId: JANICKA_PROJECT_ID,
        kind: { in: ["note", "chart", "report"] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  const tasks = tasksRaw;

  type TaskRow = (typeof tasks)[number];
  const openTasks = tasks.filter((t: TaskRow) => t.status === "open");
  const inFlightTasks = tasks.filter(
    (t: TaskRow) => t.status === "accepted" || t.status === "in_progress",
  );
  const blockedTasks = tasks.filter((t: TaskRow) => t.status === "blocked");
  const recentDone = tasks.filter((t: TaskRow) => {
    if (t.status !== "done" && t.status !== "rejected") return false;
    const ref = t.completedAt ?? t.updatedAt;
    return ref && Date.now() - ref.getTime() < 7 * 24 * 60 * 60 * 1000;
  });

  const totalActive =
    openTasks.length + inFlightTasks.length + blockedTasks.length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-foreground">
          <Briefcase className="size-6 text-primary" />
          Manažerka projektu
        </h1>
        <p className="text-sm text-muted-foreground">
          Strategický partner — sales, marketing, růst. Nepíše kód, dělá
          rozhodnutí. Tasky pro tebe a synthesy z dat.
        </p>
      </header>

      {/* Latest session status */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <Sparkles className="size-4 text-primary" />
              Poslední session
            </h2>
            {latestSession ? (
              <p className="mt-1 text-sm text-muted-foreground">
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
                Zatím žádná session. bectly ji spustí v JARVIS aplikaci.
              </p>
            )}
          </div>
          {latestSession && (
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                latestSession.status === "running"
                  ? "bg-emerald-500/15 text-emerald-700"
                  : latestSession.status === "done"
                    ? "bg-foreground/[0.08] text-muted-foreground"
                    : "bg-amber-500/15 text-amber-700"
              }`}
            >
              {STATUS_LABEL[latestSession.status] ?? latestSession.status}
            </span>
          )}
        </div>
        {latestSession?.summaryMd && (
          <details className="mt-3 rounded-md border bg-background/50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-foreground">
              Shrnutí
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-foreground/80">
              {latestSession.summaryMd}
            </pre>
          </details>
        )}
      </section>

      {/* Tasks kanban */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold">
              Tvoje úkoly od manažerky
            </h2>
            <p className="text-xs text-muted-foreground">
              {totalActive > 0
                ? `${totalActive} aktivních${recentDone.length > 0 ? ` · ${recentDone.length} dokončených (7d)` : ""}`
                : "Žádné aktivní úkoly"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <KanbanColumn
            title="Otevřené"
            count={openTasks.length}
            tasks={openTasks}
            empty="Žádné otevřené úkoly"
          />
          <KanbanColumn
            title="V práci"
            count={inFlightTasks.length}
            tasks={inFlightTasks}
            empty="Nic se právě nedělá"
          />
          <KanbanColumn
            title="Hotové · 7d"
            count={recentDone.length}
            tasks={recentDone}
            empty="Tento týden nic dokončené"
          />
        </div>

        {blockedTasks.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
            <h3 className="font-medium text-sm text-amber-700">
              Blokované ({blockedTasks.length})
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {blockedTasks.map((t: TaskRow) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Artifact feed */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-xl font-semibold">
            <Inbox className="size-5 text-primary" />
            Co manažerka říká
          </h2>
          <p className="text-xs text-muted-foreground">
            Poznámky, grafy, reporty. Nejnovější první.
          </p>
        </div>
        {artifacts.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
            Zatím žádné výstupy. Po další manažerské session se tu objeví.
          </div>
        ) : (
          <div className="space-y-3">
            {artifacts.map((a: (typeof artifacts)[number]) => (
              <ArtifactCard
                key={a.id}
                artifact={{
                  id: a.id,
                  kind: a.kind,
                  title: a.title,
                  bodyMd: a.bodyMd,
                  bodyJson: a.bodyJson,
                  status: a.status,
                  mood: a.mood,
                  createdAt: a.createdAt,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KanbanColumn({
  title,
  count,
  tasks,
  empty,
}: {
  title: string;
  count: number;
  tasks: Array<{
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
  }>;
  empty: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-foreground">{title}</h3>
        <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="rounded-md border border-dashed bg-card/30 p-4 text-center text-xs text-muted-foreground">
            {empty}
          </p>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}
