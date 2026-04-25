/**
 * Admin Manager page — Janička sees the strategic agent's output.
 *
 * Reads from JARVIS DB cross-app:
 *  - latest manager_sessions row → status pill + start button gating
 *  - human_tasks (project_id=15) → kanban (open / in-flight / done)
 *  - manager_artifacts (note + report + chart, last 10) → feed
 *
 * Plan: ~/.claude/plans/piped-orbiting-fox.md (MS-γ)
 */
import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Briefcase, Inbox } from "lucide-react";

import { ArtifactCard } from "@/components/admin/manager/artifact-card";
import { ManagerPoll } from "@/components/admin/manager/manager-poll";
import { PriorityFilter } from "@/components/admin/manager/priority-filter";
import { StartSessionForm } from "@/components/admin/manager/start-session-form";
import { TaskCard } from "@/components/admin/manager/task-card";
import { formatCzDate } from "@/components/admin/manager/task-meta";
import {
  JANICKA_PROJECT_ID,
  getLatestManagerSession,
  listHumanTasks,
  listManagerArtifacts,
  type HumanTask,
  type HumanTaskPriority,
} from "@/lib/jarvis-db";

export const metadata: Metadata = {
  title: "Manažerka",
};

const VALID_PRIORITIES: HumanTaskPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
];

function isPriority(v: string): v is HumanTaskPriority {
  return (VALID_PRIORITIES as string[]).includes(v);
}

function isWithinLastDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() <= days * 24 * 60 * 60 * 1000;
}

export default async function AdminManagerPage({
  searchParams,
}: {
  searchParams: Promise<{ priority?: string }>;
}) {
  await connection();

  const params = await searchParams;
  const priorityParam = params.priority ?? "all";
  const activePriority: "all" | HumanTaskPriority = isPriority(priorityParam)
    ? priorityParam
    : "all";

  const [latestSession, allTasks, artifacts] = await Promise.all([
    getLatestManagerSession(JANICKA_PROJECT_ID),
    listHumanTasks({
      projectId: JANICKA_PROJECT_ID,
      status: [
        "open",
        "accepted",
        "in_progress",
        "blocked",
        "done",
        "rejected",
      ],
      limit: 200,
    }),
    listManagerArtifacts({
      projectId: JANICKA_PROJECT_ID,
      kinds: ["note", "report", "chart"],
      limit: 10,
    }),
  ]);

  const filteredTasks =
    activePriority === "all"
      ? allTasks
      : allTasks.filter((t) => t.priority === activePriority);

  const openTasks = filteredTasks.filter((t) => t.status === "open");
  const inFlightTasks = filteredTasks.filter(
    (t) => t.status === "accepted" || t.status === "in_progress",
  );
  const blockedTasks = filteredTasks.filter((t) => t.status === "blocked");
  const recentDoneTasks = filteredTasks.filter(
    (t) =>
      (t.status === "done" || t.status === "rejected") &&
      isWithinLastDays(t.completed_at ?? t.updated_at, 7),
  );

  const isRunning =
    latestSession?.status === "running" || latestSession?.status === "paused";

  const totalActive = allTasks.filter(
    (t) => t.status !== "done" && t.status !== "rejected" && t.status !== "stale",
  ).length;

  return (
    <div className="space-y-6">
      <ManagerPoll />

      {/* Heading */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-foreground">
            <Briefcase className="size-6 text-primary" />
            Manažerka projektu
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Strategický partner pro Janičku — sales, marketing, růst.
          </p>
        </div>
        <ManagerStatusPill running={isRunning} session={latestSession} />
      </header>

      {/* Start session */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 font-heading text-base font-semibold">
          {isRunning ? "Manažerka běží" : "Spustit novou session"}
        </h2>
        <StartSessionForm disabled={isRunning} />
        {latestSession?.summary_md ? (
          <details className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Souhrn předchozí session ({formatCzDate(latestSession.started_at)})
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {latestSession.summary_md}
            </pre>
          </details>
        ) : null}
      </section>

      {/* Human tasks kanban */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-semibold">
              Tvoje úkoly od manažerky
            </h2>
            <p className="text-sm text-muted-foreground">
              {totalActive > 0
                ? `${totalActive} aktivních úkolů celkem`
                : "Zatím nic aktivního"}
            </p>
          </div>
          <Suspense fallback={null}>
            <PriorityFilter active={activePriority} />
          </Suspense>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <KanbanColumn
            label="Otevřené"
            count={openTasks.length}
            tone="primary"
            emptyText="Žádné nové úkoly."
            tasks={openTasks}
          />
          <KanbanColumn
            label="V práci"
            count={inFlightTasks.length + blockedTasks.length}
            tone="amber"
            emptyText="Nic se právě nedělá."
            tasks={[...inFlightTasks, ...blockedTasks]}
          />
          <KanbanColumn
            label="Hotové (7 dní)"
            count={recentDoneTasks.length}
            tone="emerald"
            emptyText="Tento týden ještě nic dokončeno."
            tasks={recentDoneTasks}
          />
        </div>
      </section>

      {/* Artifact feed */}
      <section className="space-y-3">
        <h2 className="font-heading text-xl font-semibold">
          Co manažerka říká
        </h2>
        {artifacts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed bg-card p-6 text-sm text-muted-foreground">
            <Inbox className="size-5" />
            Manažerka zatím nic nenapsala. Spusť session nahoře.
          </div>
        ) : (
          <div className="space-y-2">
            {artifacts.map((a) => (
              <ArtifactCard key={a.id} artifact={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ManagerStatusPill({
  running,
  session,
}: {
  running: boolean;
  session: Awaited<ReturnType<typeof getLatestManagerSession>>;
}) {
  if (running) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
        Běží — od {session ? formatCzDate(session.started_at) : "?"}
      </span>
    );
  }
  if (session) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
        <span className="size-2 rounded-full bg-muted-foreground/50" />
        Idle — naposled {formatCzDate(session.started_at)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
      <span className="size-2 rounded-full bg-muted-foreground/50" />
      Ještě nikdy nespuštěna
    </span>
  );
}

function KanbanColumn({
  label,
  count,
  tone,
  tasks,
  emptyText,
}: {
  label: string;
  count: number;
  tone: "primary" | "amber" | "emerald";
  tasks: HumanTask[];
  emptyText: string;
}) {
  const toneClasses: Record<string, string> = {
    primary: "border-primary/30 bg-primary/5",
    amber: "border-amber-300/40 bg-amber-50 dark:bg-amber-950/20",
    emerald:
      "border-emerald-300/40 bg-emerald-50 dark:bg-emerald-950/20",
  };

  return (
    <div className={`rounded-xl border ${toneClasses[tone]} p-3`}>
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          {label}
        </h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold">
          {count}
        </span>
      </header>
      {tasks.length === 0 ? (
        <p className="rounded-md border border-dashed bg-background/50 p-4 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}
