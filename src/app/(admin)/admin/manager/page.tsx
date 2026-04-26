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
import { Bot, Briefcase, Inbox, Sparkles } from "lucide-react";

import { getDb } from "@/lib/db";
import { getJanickaDevloopTasks } from "@/lib/jarvis-db";
import { ArtifactCard } from "@/components/admin/manager/artifact-card";
import { TaskCard } from "@/components/admin/manager/task-card";
import { DevloopTaskCard } from "@/components/admin/manager/devloop-task-card";
import { StartSessionForm } from "@/components/admin/manager/start-session-form";

const JANICKA_PROJECT_ID = 15;

export const metadata: Metadata = {
  title: "Manažerka",
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
  const [latestSession, tasksRaw, artifacts, devloopTasks] = await Promise.all([
    prisma.managerSession.findFirst({
      where: { projectId: JANICKA_PROJECT_ID },
      orderBy: [{ requestedAt: "desc" }, { startedAt: "desc" }],
    }),
    prisma.managerTask.findMany({
      where: { projectId: JANICKA_PROJECT_ID },
      orderBy: [{ priority: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        comments: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    }),
    prisma.managerArtifact.findMany({
      where: {
        projectId: JANICKA_PROJECT_ID,
        kind: { in: ["note", "chart", "report"] },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        comments: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    }),
    getJanickaDevloopTasks(),
  ]);
  const devloopOpen = devloopTasks.filter((t) => t.status === "open");
  const devloopBlocked = devloopTasks.filter((t) => t.status === "blocked");
  const tasks = tasksRaw;
  const sessionBusy =
    latestSession?.status === "requested" ||
    latestSession?.status === "claimed" ||
    latestSession?.status === "running";
  const sessionBusyReason = sessionBusy
    ? latestSession?.status === "requested"
      ? "Manažerka je ve frontě — startuje do 30 sekund."
      : latestSession?.status === "claimed"
        ? "Manažerka se právě spouští…"
        : "Manažerka teď běží — počkej až dokončí."
    : undefined;

  type TaskRow = (typeof tasks)[number];
  const openTasks = tasks.filter((t: TaskRow) => t.status === "open");
  const inFlightTasks = tasks.filter(
    (t: TaskRow) => t.status === "accepted" || t.status === "in_progress",
  );
  const blockedTasks = tasks.filter((t: TaskRow) => t.status === "blocked");
  // eslint-disable-next-line react-hooks/purity -- request-time read in RSC, not cached
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentDone = tasks.filter((t: TaskRow) => {
    if (t.status !== "done" && t.status !== "rejected") return false;
    const ref = t.completedAt ?? t.updatedAt;
    return ref ? ref.getTime() >= recentCutoff : false;
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

      {/* Spustit session + status */}
      <section className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-base font-semibold">
              <Sparkles className="size-4 text-primary" />
              Spustit manažerku
            </h2>
            {latestSession ? (
              <p className="mt-1 text-sm text-muted-foreground">
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
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                latestSession.status === "running"
                  ? "bg-emerald-500/15 text-emerald-700"
                  : latestSession.status === "requested" ||
                      latestSession.status === "claimed"
                    ? "bg-amber-500/15 text-amber-700"
                    : latestSession.status === "done"
                      ? "bg-foreground/[0.08] text-muted-foreground"
                      : "bg-red-500/15 text-red-700"
              }`}
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

      {/* Devloop tasks (AI workers) */}
      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-xl font-semibold">
            <Bot className="size-5 text-primary" />
            Devloop tasky (AI workers)
          </h2>
          <p className="text-xs text-muted-foreground">
            Co řeší Bolt, Trace, Lead a spol. v pozadí. Tasky které jsi zadala
            přes manažerku nebo promote ze shopu můžeš zavřít/blokovat — ostatní
            jsou jen na čtení.
          </p>
        </div>
        {devloopTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Žádné aktivní devloop tasky (nebo JARVIS DB není dostupná z tohohle
            prostředí).
          </div>
        ) : (
          <>
            {devloopOpen.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {devloopOpen.map((t) => (
                  <DevloopTaskCard key={t.id} task={t} />
                ))}
              </div>
            )}
            {devloopBlocked.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <h3 className="font-medium text-sm text-amber-700">
                  Blokované ({devloopBlocked.length})
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {devloopBlocked.map((t) => (
                    <DevloopTaskCard key={t.id} task={t} />
                  ))}
                </div>
              </div>
            )}
          </>
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
