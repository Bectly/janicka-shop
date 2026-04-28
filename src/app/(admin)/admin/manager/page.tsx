/**
 * Admin Manager page — Janička sees the strategic agent's output.
 *
 * Tabbed UI (J24-J27):
 *   Tab 1 Konverzace — placeholder until Bolt's J24 thread UI lands
 *   Tab 2 Úkoly      — manager kanban + collapsible devloop section + blocked
 *   Tab 3 Reporty    — filterable artifact feed (kind + range, Export PDF)
 *   Tab 4 Session    — admin-only: start form + session history with artifacts
 *
 * Reads NATIVELY from janicka's own Turso DB via Prisma:
 *  - latest ManagerSession + recent history
 *  - ManagerTask (open / accepted+in_progress / blocked / done last 7d)
 *  - ManagerArtifact (note + report + chart + task_*, last 50)
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { Briefcase, MessageSquare } from "lucide-react";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getJanickaDevloopTasks } from "@/lib/jarvis-db";
import { ManagerTabsShell } from "@/components/admin/manager/tabs-shell";
import { TasksTab } from "@/components/admin/manager/tasks-tab";
import { ReportsTab } from "@/components/admin/manager/reports-tab";
import { SessionTab } from "@/components/admin/manager/session-tab";

const JANICKA_PROJECT_ID = 15;

export const metadata: Metadata = {
  title: "Manažerka",
};

export default async function AdminManagerPage() {
  await connection();

  const [session, prisma] = await Promise.all([auth(), getDb()]);
  const isAdmin = session?.user?.role === "admin";

  const [latestSession, tasksRaw, artifacts, devloopTasks, recentSessions] =
    await Promise.all([
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
          kind: { in: ["note", "chart", "report", "task_ai", "task_human"] },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          comments: { orderBy: { createdAt: "asc" }, take: 50 },
        },
      }),
      getJanickaDevloopTasks(),
      isAdmin
        ? prisma.managerSession.findMany({
            where: { projectId: JANICKA_PROJECT_ID },
            orderBy: [{ startedAt: "desc" }],
            take: 20,
            include: {
              artifacts: {
                orderBy: { createdAt: "desc" },
                take: 50,
              },
            },
          })
        : Promise.resolve([]),
    ]);

  const devloopOpen = devloopTasks.filter((t) => t.status === "open");
  const devloopBlocked = devloopTasks.filter((t) => t.status === "blocked");

  const tasks = tasksRaw;
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

  const totalActive =
    openTasks.length + inFlightTasks.length + blockedTasks.length;

  const sessionRows = recentSessions.map((s) => ({
    id: s.id,
    status: s.status,
    triggeredBy: s.triggeredBy,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    endReason: s.endReason,
    summaryMd: s.summaryMd,
    costUsd: s.costUsd,
    tokensTotal: s.tokensTotal,
    artifactCount: s.artifacts.length,
    artifacts: s.artifacts.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      bodyMd: a.bodyMd,
      bodyJson: a.bodyJson,
      status: a.status,
      mood: a.mood,
      createdAt: a.createdAt,
    })),
  }));

  return (
    <div className="space-y-6 max-w-full">
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

      <ManagerTabsShell
        isAdmin={isAdmin}
        badges={{ ukoly: totalActive, reporty: artifacts.length }}
        conversationTab={<ConversationPlaceholder />}
        tasksTab={
          <TasksTab
            openTasks={openTasks}
            inFlightTasks={inFlightTasks}
            recentDone={recentDone}
            blockedTasks={blockedTasks}
            devloopOpen={devloopOpen}
            devloopBlocked={devloopBlocked}
          />
        }
        reportsTab={<ReportsTab artifacts={artifacts} />}
        sessionTab={
          isAdmin ? (
            <SessionTab
              latestSession={
                latestSession
                  ? {
                      id: latestSession.id,
                      status: latestSession.status,
                      triggeredBy: latestSession.triggeredBy,
                      startedAt: latestSession.startedAt,
                      endedAt: latestSession.endedAt,
                      endReason: latestSession.endReason,
                      summaryMd: latestSession.summaryMd,
                      costUsd: latestSession.costUsd,
                      tokensTotal: latestSession.tokensTotal,
                      artifactCount: 0,
                      artifacts: [],
                    }
                  : null
              }
              sessions={sessionRows}
              sessionBusy={sessionBusy}
              sessionBusyReason={sessionBusyReason}
            />
          ) : null
        }
      />
    </div>
  );
}

function ConversationPlaceholder() {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center space-y-3">
      <MessageSquare className="mx-auto size-8 text-muted-foreground" />
      <div>
        <p className="font-medium text-sm">Konverzace s manažerkou</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Threadovaný chat s typovanými bloky (text / graf / akce / poll).
          Aktuálně se dokončuje napojení (J23 + J24). Mezitím můžeš spustit
          klasickou session na záložce <strong>Session</strong>.
        </p>
      </div>
    </div>
  );
}
