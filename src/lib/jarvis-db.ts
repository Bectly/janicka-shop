/**
 * Read-mostly bridge to the local JARVIS sqlite (`~/.claude/jarvis-gym/jarvis.db`).
 *
 * Only meaningful when the admin runs on bectly's dev machine — Vercel prod has no
 * filesystem access to JARVIS. All public helpers return empty/no-op values when the
 * DB is unreachable so the manager page degrades silently in prod.
 *
 * Mutations are restricted to tasks Janička "owns" (created via the manager session
 * or the shop-task → devloop promote pipeline). Lead/Bolt/Trace tasks stay read-only.
 */
import { createClient, type Client } from "@libsql/client";

const DEFAULT_JARVIS_DB_URL = "file:/home/bectly/.claude/jarvis-gym/jarvis.db";
const JANICKA_PROJECT_ID = 15;

export type DevloopTaskRow = {
  id: number;
  projectId: number;
  tag: string;
  title: string;
  description: string | null;
  status: string;
  blockedReason: string | null;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
  cycleCompleted: number | null;
  sourceHumanTaskId: number | null;
  janickaOwned: boolean;
};

let cachedClient: Client | null = null;
let cachedClientFailed = false;

function getClient(): Client | null {
  if (cachedClient) return cachedClient;
  if (cachedClientFailed) return null;
  const url = (process.env.JARVIS_DB_URL || DEFAULT_JARVIS_DB_URL).trim();
  if (!url.startsWith("file:") && !url.startsWith("libsql:") && !url.startsWith("http")) {
    cachedClientFailed = true;
    return null;
  }
  try {
    cachedClient = createClient({ url });
    return cachedClient;
  } catch {
    cachedClientFailed = true;
    return null;
  }
}

/**
 * Janička "owns" a task only if she (or the promote-from-shop pipeline she triggered)
 * filed it. Lead-research / agent-spawned tasks stay read-only — she can comment via
 * JARVIS but the manager UI shouldn't let her flip their status.
 */
export function isJanickaOwned(createdBy: string | null | undefined): boolean {
  if (!createdBy) return false;
  if (createdBy.startsWith("manager-session-")) return true;
  if (createdBy === "promote-from-shop-cli") return true;
  return false;
}

export async function getJanickaDevloopTasks(): Promise<DevloopTaskRow[]> {
  const client = getClient();
  if (!client) return [];
  try {
    const result = await client.execute({
      sql: `
        SELECT id, project_id, tag, title, description, status, blocked_reason,
               created_by, created_at, completed_at, cycle_completed,
               source_human_task_id
          FROM devloop_tasks
         WHERE project_id = ?
           AND status IN ('open', 'blocked')
           AND created_at >= datetime('now', '-60 days')
         ORDER BY datetime(created_at) DESC
         LIMIT 100
      `,
      args: [JANICKA_PROJECT_ID],
    });
    return result.rows.map((row) => {
      const createdBy = (row.created_by as string | null) ?? null;
      return {
        id: Number(row.id),
        projectId: Number(row.project_id),
        tag: String(row.tag ?? ""),
        title: String(row.title ?? ""),
        description: (row.description as string | null) ?? null,
        status: String(row.status ?? "open"),
        blockedReason: (row.blocked_reason as string | null) ?? null,
        createdBy,
        createdAt: String(row.created_at ?? ""),
        completedAt: (row.completed_at as string | null) ?? null,
        cycleCompleted:
          row.cycle_completed === null || row.cycle_completed === undefined
            ? null
            : Number(row.cycle_completed),
        sourceHumanTaskId:
          row.source_human_task_id === null || row.source_human_task_id === undefined
            ? null
            : Number(row.source_human_task_id),
        janickaOwned: isJanickaOwned(createdBy),
      };
    });
  } catch {
    return [];
  }
}

async function getOwnedTask(id: number): Promise<DevloopTaskRow | null> {
  const client = getClient();
  if (!client) return null;
  const result = await client.execute({
    sql: `SELECT id, project_id, tag, title, description, status, blocked_reason,
                 created_by, created_at, completed_at, cycle_completed,
                 source_human_task_id
            FROM devloop_tasks
           WHERE id = ? AND project_id = ?`,
    args: [id, JANICKA_PROJECT_ID],
  });
  const row = result.rows[0];
  if (!row) return null;
  const createdBy = (row.created_by as string | null) ?? null;
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    tag: String(row.tag ?? ""),
    title: String(row.title ?? ""),
    description: (row.description as string | null) ?? null,
    status: String(row.status ?? "open"),
    blockedReason: (row.blocked_reason as string | null) ?? null,
    createdBy,
    createdAt: String(row.created_at ?? ""),
    completedAt: (row.completed_at as string | null) ?? null,
    cycleCompleted:
      row.cycle_completed === null || row.cycle_completed === undefined
        ? null
        : Number(row.cycle_completed),
    sourceHumanTaskId:
      row.source_human_task_id === null || row.source_human_task_id === undefined
        ? null
        : Number(row.source_human_task_id),
    janickaOwned: isJanickaOwned(createdBy),
  };
}

export async function markDevloopTaskBlocked(
  id: number,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getClient();
  if (!client) return { ok: false, error: "JARVIS DB nedostupná" };
  const task = await getOwnedTask(id);
  if (!task) return { ok: false, error: "Task nenalezen" };
  if (!task.janickaOwned) {
    return { ok: false, error: "Tenhle task nezadala Janička — read-only" };
  }
  if (task.status === "done" || task.status === "completed") {
    return { ok: false, error: "Task už je hotový" };
  }
  const trimmed = reason.trim().slice(0, 500);
  if (!trimmed) return { ok: false, error: "Důvod blokace nemůže být prázdný" };
  try {
    await client.execute({
      sql: `UPDATE devloop_tasks
               SET status = 'blocked', blocked_reason = ?
             WHERE id = ? AND project_id = ?`,
      args: [trimmed, id, JANICKA_PROJECT_ID],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB chyba" };
  }
}

export async function markDevloopTaskCompleted(
  id: number,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = getClient();
  if (!client) return { ok: false, error: "JARVIS DB nedostupná" };
  const task = await getOwnedTask(id);
  if (!task) return { ok: false, error: "Task nenalezen" };
  if (!task.janickaOwned) {
    return { ok: false, error: "Tenhle task nezadala Janička — read-only" };
  }
  if (task.status === "done" || task.status === "completed") {
    return { ok: true };
  }
  // devloop_tasks has no completion_notes column — propagate via human_tasks trigger
  // (trg_human_task_auto_done_on_devloop_complete) when source_human_task_id is set.
  try {
    await client.execute({
      sql: `UPDATE devloop_tasks
               SET status = 'done', completed_at = datetime('now')
             WHERE id = ? AND project_id = ?`,
      args: [id, JANICKA_PROJECT_ID],
    });
    if (task.sourceHumanTaskId !== null && notes && notes.trim()) {
      const trimmed = notes.trim().slice(0, 1000);
      await client.execute({
        sql: `UPDATE human_tasks
                 SET completion_notes = COALESCE(completion_notes, '')
                                       || CASE WHEN length(COALESCE(completion_notes,''))>0
                                               THEN char(10) ELSE '' END
                                       || ?,
                     updated_at = datetime('now')
               WHERE id = ?`,
        args: [trimmed, task.sourceHumanTaskId],
      });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "DB chyba" };
  }
}
