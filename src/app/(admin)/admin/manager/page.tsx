/**
 * Admin Manager page — Janička sees the strategic agent's output.
 *
 * Two shells:
 *   v1 (default)   — 4-tab: Konverzace / Úkoly / Reporty / Session
 *   v2 (MANAGER_UI_V2=1) — 2-tab: Dnes / Historie (no devloop, no technical noise)
 *
 * Reads NATIVELY from janicka's own Turso DB via Prisma:
 *  - latest ManagerSession + recent history (admin only)
 *  - ManagerTask (open / accepted+in_progress / blocked / done last 7d)
 *  - ManagerArtifact (note + report + chart + task_*, last 50)
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { Briefcase } from "lucide-react";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getJanickaDevloopTasks } from "@/lib/jarvis-db";
import {
  ManagerTabsShell,
  ManagerTabsShellV2,
} from "@/components/admin/manager/tabs-shell";
import { TasksTab } from "@/components/admin/manager/tasks-tab";
import { ReportsTab } from "@/components/admin/manager/reports-tab";
import { SessionTab } from "@/components/admin/manager/session-tab";
import { ThreadsTab } from "@/components/admin/manager/threads-tab";
import { TodayTab } from "@/components/admin/manager/today-tab";
import { HistoryTab } from "@/components/admin/manager/history-tab";
import { WorkspaceTabsShell } from "@/components/admin/manager/workspace-tabs-shell";
import type { WorkspaceTabRow } from "@/app/(admin)/admin/manager/workspace/actions";

const JANICKA_PROJECT_ID = 15;
const V2_FLAG = process.env.MANAGER_UI_V2 === "1";
const WORKSPACE_FLAG = process.env.MANAGER_WORKSPACE === "1";

export const metadata: Metadata = {
  title: "Manažerka",
};

function previewFromBlocks(contentJson: string, max = 220): string {
  try {
    const parsed = JSON.parse(contentJson) as unknown;
    if (!Array.isArray(parsed)) return "";
    const textParts: string[] = [];
    for (const block of parsed) {
      if (
        block &&
        typeof block === "object" &&
        "type" in block &&
        (block as { type?: unknown }).type === "text"
      ) {
        const body = (block as { bodyMd?: unknown }).bodyMd;
        if (typeof body === "string" && body.trim()) textParts.push(body.trim());
      }
    }
    const joined = textParts.join("\n\n").replace(/\s+/g, " ").trim();
    return joined.length > max ? joined.slice(0, max - 1) + "…" : joined;
  } catch {
    return "";
  }
}

export default async function AdminManagerPage() {
  await connection();

  const [session, prisma] = await Promise.all([auth(), getDb()]);
  const isAdmin = session?.user?.role === "admin";

  if (V2_FLAG) {
    return renderV2({ prisma, isAdmin });
  }

  return renderV1({ prisma, isAdmin });
}

async function renderV1({
  prisma,
  isAdmin,
}: {
  prisma: Awaited<ReturnType<typeof getDb>>;
  isAdmin: boolean;
}) {
  const [
    latestSession,
    tasksRaw,
    artifacts,
    devloopTasks,
    recentSessions,
    unreadThreadCount,
  ] = await Promise.all([
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
    prisma.managerThreadMessage.count({
      where: {
        role: "manager",
        readAt: null,
        thread: { projectId: JANICKA_PROJECT_ID },
      },
    }),
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
        badges={{
          konverzace: unreadThreadCount,
          ukoly: totalActive,
          reporty: artifacts.length,
        }}
        conversationTab={<ThreadsTab />}
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

async function renderV2({
  prisma,
  isAdmin: _isAdmin,
}: {
  prisma: Awaited<ReturnType<typeof getDb>>;
  isAdmin: boolean;
}) {
  // Today bucket: midnight Europe/Prague projected to UTC for the query.
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [tasks, artifacts, latestManagerMessageRow] = await Promise.all([
    prisma.managerTask.findMany({
      where: {
        projectId: JANICKA_PROJECT_ID,
        status: { in: ["open", "accepted", "in_progress"] },
      },
      orderBy: [{ priority: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        comments: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    }),
    prisma.managerArtifact.findMany({
      where: {
        projectId: JANICKA_PROJECT_ID,
        kind: { in: ["task_human", "report"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        comments: { orderBy: { createdAt: "asc" }, take: 50 },
      },
    }),
    prisma.managerThreadMessage.findFirst({
      where: {
        role: "manager",
        thread: { projectId: JANICKA_PROJECT_ID },
      },
      orderBy: { createdAt: "desc" },
      include: { thread: true },
    }),
  ]);

  const actionableTasks = tasks;
  const totalActive = tasks.length;

  const todayReportRow =
    artifacts.find(
      (a) => a.kind === "report" && a.createdAt >= startOfToday,
    ) ?? null;
  const todayReport = todayReportRow
    ? {
        id: todayReportRow.id,
        title: todayReportRow.title,
        bodyMd: todayReportRow.bodyMd,
        bodyJson: todayReportRow.bodyJson,
        createdAt: todayReportRow.createdAt,
      }
    : null;

  const latestManagerMessage = latestManagerMessageRow
    ? {
        id: latestManagerMessageRow.id,
        threadId: latestManagerMessageRow.threadId,
        threadSubject: latestManagerMessageRow.thread.subject ?? null,
        preview: previewFromBlocks(latestManagerMessageRow.contentJson),
        createdAt: latestManagerMessageRow.createdAt,
      }
    : null;

  const historyArtifacts = artifacts.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title,
    bodyMd: a.bodyMd,
    bodyJson: a.bodyJson,
    status: a.status,
    mood: a.mood,
    createdAt: a.createdAt,
    comments: a.comments,
  }));

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const historyCount = historyArtifacts.filter(
    (a) => a.createdAt.getTime() >= cutoff,
  ).length;

  // Phase 11b: hybrid shell with workspace conversation tabs (gated by flag).
  // Falls back to the 2-tab shell if MANAGER_WORKSPACE is unset so we can
  // ship the schema/actions without forcing the UI on Janička yet.
  let workspaceTabs: WorkspaceTabRow[] = [];
  if (WORKSPACE_FLAG) {
    const tabRows = await prisma.managerWorkspaceTab.findMany({
      where: { projectId: JANICKA_PROJECT_ID },
      orderBy: [{ status: "asc" }, { lastActivityAt: "desc" }],
      take: 200,
    });
    workspaceTabs = await Promise.all(
      tabRows.map(async (t) => {
        const settings =
          t.settingsJson && typeof t.settingsJson === "object"
            ? (t.settingsJson as Record<string, unknown>)
            : {};
        const lastSeenRaw = settings.lastSeenAt;
        const lastSeen = typeof lastSeenRaw === "string" ? lastSeenRaw : null;
        const unreadCount = await prisma.workspaceMessage.count({
          where: {
            tabId: t.id,
            role: "manager",
            createdAt: lastSeen ? { gt: new Date(lastSeen) } : undefined,
          },
        });
        const status: "active" | "pinned" | "archived" =
          t.status === "pinned" || t.status === "archived"
            ? t.status
            : "active";
        return {
          id: t.id,
          title: t.title,
          status,
          createdAt: t.createdAt.toISOString(),
          lastActivityAt: t.lastActivityAt.toISOString(),
          unreadCount,
          lastSeenAt: lastSeen,
        };
      }),
    );
  }

  return (
    <div className="space-y-6 max-w-full">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-foreground">
          <Briefcase className="size-6 text-primary" />
          Manažerka projektu
        </h1>
        <p className="text-sm text-muted-foreground">
          Co máš dneska udělat a co ti manažerka napsala v posledních dnech.
        </p>
      </header>

      {WORKSPACE_FLAG ? (
        <WorkspaceTabsShell
          fixedBadges={{ dnes: totalActive, historie: historyCount }}
          todayTab={
            <TodayTab
              actionableTasks={actionableTasks}
              todayReport={todayReport}
              latestManagerMessage={latestManagerMessage}
            />
          }
          historyTab={<HistoryTab artifacts={historyArtifacts} />}
          initialTabs={workspaceTabs}
        />
      ) : (
        <ManagerTabsShellV2
          badges={{ dnes: totalActive, historie: historyCount }}
          todayTab={
            <TodayTab
              actionableTasks={actionableTasks}
              todayReport={todayReport}
              latestManagerMessage={latestManagerMessage}
            />
          }
          historyTab={<HistoryTab artifacts={historyArtifacts} />}
        />
      )}
    </div>
  );
}
