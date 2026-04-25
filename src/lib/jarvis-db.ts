/**
 * Cross-app SQLite client for the JARVIS DB.
 *
 * The JARVIS daemon (running on the same machine as this dev/prod server)
 * persists Manager Framework state into `~/.claude/jarvis-gym/jarvis.db`.
 * Janička's admin reads + writes a small subset of that schema:
 *   - human_tasks (kanban + status transitions)
 *   - manager_artifacts (notes / charts / reports feed)
 *   - manager_sessions (status pill + history)
 *
 * Plan: ~/.claude/plans/piped-orbiting-fox.md (MS-γ)
 * Schema: see `services/migrations/2026-04-25_manager.sql`
 *
 * NOTE: localhost-only file path. In production this lib must be a no-op
 * fallback — we detect that via process.env.JARVIS_DB_PATH override and
 * gracefully degrade if the file is missing.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { type Client, createClient } from "@libsql/client";

const JARVIS_DB_PATH =
  process.env.JARVIS_DB_PATH ?? "/home/bectly/.claude/jarvis-gym/jarvis.db";

const MANAGER_RUNNER_PATH =
  process.env.JARVIS_MANAGER_RUNNER_PATH ??
  "/home/bectly/.claude/jarvis-gym/services/manager_runner.py";

const PYTHON_BIN = process.env.JARVIS_PYTHON_BIN ?? "python3";

// Project id for janicka-shop — fixed per JARVIS DB.
export const JANICKA_PROJECT_ID = 15;

// ---------------------------------------------------------------------------
// Types — mirror the JARVIS DB schema
// ---------------------------------------------------------------------------

export type HumanTaskStatus =
  | "open"
  | "accepted"
  | "in_progress"
  | "blocked"
  | "done"
  | "rejected"
  | "stale";

export type HumanTaskPriority = "urgent" | "high" | "medium" | "low";

export type HumanTaskCategory =
  | "sales"
  | "marketing"
  | "tech"
  | "analytics"
  | "people"
  | "strategy"
  | "admin"
  | "other";

export type HumanTask = {
  id: number;
  project_id: number;
  session_id: number | null;
  source_artifact_id: number | null;
  category: HumanTaskCategory;
  priority: HumanTaskPriority;
  assignee_hint: string | null;
  title: string;
  description_md: string;
  rationale_md: string | null;
  expected_outcome: string | null;
  due_at: string | null;
  status: HumanTaskStatus;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ManagerArtifactKind =
  | "note"
  | "chart"
  | "report"
  | "task_ai"
  | "task_human"
  | "access_request"
  | "amendment"
  | "action_proposal"
  | "screenshot";

export type ManagerArtifact = {
  id: number;
  session_id: number;
  project_id: number;
  kind: ManagerArtifactKind;
  title: string | null;
  body_md: string | null;
  body_json: string | null;
  parent_artifact_id: number | null;
  status: string;
  mood: string | null;
  created_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
};

export type ManagerSessionStatus =
  | "running"
  | "paused"
  | "done"
  | "aborted"
  | "failed";

export type ManagerSession = {
  id: number;
  project_id: number;
  worker_session_id: number | null;
  status: ManagerSessionStatus;
  started_at: string;
  ended_at: string | null;
  summary_md: string | null;
  cost_usd: number;
  tokens_total: number;
  worker_name: string | null;
  task_id: number | null;
  triggered_by: string | null;
  end_reason: string | null;
};

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let _client: Client | null = null;

function getJarvisDb(): Client | null {
  if (_client) return _client;
  if (!existsSync(JARVIS_DB_PATH)) {
    console.warn(
      `[jarvis-db] DB file not found at ${JARVIS_DB_PATH} — manager features disabled.`,
    );
    return null;
  }
  _client = createClient({ url: `file:${JARVIS_DB_PATH}` });
  return _client;
}

// Type-safe row coercion. libsql returns rows as Record<string, Value> where
// Value = null | string | number | bigint | ArrayBuffer; we narrow each shape.
type Row = Record<string, unknown>;

function asString(v: unknown): string {
  if (v == null) return "";
  return typeof v === "bigint" ? v.toString() : String(v);
}
function asStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "bigint" ? v.toString() : String(v);
}
function asNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  return typeof v === "number" ? v : Number(v);
}
function asNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "bigint") return Number(v);
  return typeof v === "number" ? v : Number(v);
}

function rowToHumanTask(r: Row): HumanTask {
  return {
    id: asNumber(r.id),
    project_id: asNumber(r.project_id),
    session_id: asNumberOrNull(r.session_id),
    source_artifact_id: asNumberOrNull(r.source_artifact_id),
    category: asString(r.category) as HumanTaskCategory,
    priority: asString(r.priority) as HumanTaskPriority,
    assignee_hint: asStringOrNull(r.assignee_hint),
    title: asString(r.title),
    description_md: asString(r.description_md),
    rationale_md: asStringOrNull(r.rationale_md),
    expected_outcome: asStringOrNull(r.expected_outcome),
    due_at: asStringOrNull(r.due_at),
    status: asString(r.status) as HumanTaskStatus,
    accepted_at: asStringOrNull(r.accepted_at),
    started_at: asStringOrNull(r.started_at),
    completed_at: asStringOrNull(r.completed_at),
    completion_notes: asStringOrNull(r.completion_notes),
    created_at: asString(r.created_at),
    updated_at: asString(r.updated_at),
  };
}

function rowToArtifact(r: Row): ManagerArtifact {
  return {
    id: asNumber(r.id),
    session_id: asNumber(r.session_id),
    project_id: asNumber(r.project_id),
    kind: asString(r.kind) as ManagerArtifactKind,
    title: asStringOrNull(r.title),
    body_md: asStringOrNull(r.body_md),
    body_json: asStringOrNull(r.body_json),
    parent_artifact_id: asNumberOrNull(r.parent_artifact_id),
    status: asString(r.status),
    mood: asStringOrNull(r.mood),
    created_at: asString(r.created_at),
    accepted_at: asStringOrNull(r.accepted_at),
    accepted_by: asStringOrNull(r.accepted_by),
  };
}

function rowToSession(r: Row): ManagerSession {
  return {
    id: asNumber(r.id),
    project_id: asNumber(r.project_id),
    worker_session_id: asNumberOrNull(r.worker_session_id),
    status: asString(r.status) as ManagerSessionStatus,
    started_at: asString(r.started_at),
    ended_at: asStringOrNull(r.ended_at),
    summary_md: asStringOrNull(r.summary_md),
    cost_usd: asNumber(r.cost_usd),
    tokens_total: asNumber(r.tokens_total),
    worker_name: asStringOrNull(r.worker_name),
    task_id: asNumberOrNull(r.task_id),
    triggered_by: asStringOrNull(r.triggered_by),
    end_reason: asStringOrNull(r.end_reason),
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Fetch human tasks. Default ORDER prioritises urgent > high > medium > low,
 * then nearest due date (NULLs last), then most-recent created.
 */
export async function listHumanTasks(opts: {
  projectId?: number;
  status?: HumanTaskStatus | HumanTaskStatus[];
  assigneeHint?: string;
  limit?: number;
} = {}): Promise<HumanTask[]> {
  const db = getJarvisDb();
  if (!db) return [];

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.projectId !== undefined) {
    where.push("project_id = ?");
    args.push(opts.projectId);
  }
  if (opts.status) {
    if (Array.isArray(opts.status)) {
      const placeholders = opts.status.map(() => "?").join(",");
      where.push(`status IN (${placeholders})`);
      args.push(...opts.status);
    } else {
      where.push("status = ?");
      args.push(opts.status);
    }
  }
  if (opts.assigneeHint) {
    where.push("assignee_hint = ?");
    args.push(opts.assigneeHint);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limitSql = opts.limit ? `LIMIT ${Math.max(1, Math.floor(opts.limit))}` : "";

  const sql = `
    SELECT *
    FROM human_tasks
    ${whereSql}
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 0
        WHEN 'high'   THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low'    THEN 3
        ELSE 4
      END,
      CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
      due_at ASC,
      created_at DESC
    ${limitSql}
  `.trim();

  const result = await db.execute({ sql, args });
  return result.rows.map((r) => rowToHumanTask(r as Row));
}

export async function getHumanTask(id: number): Promise<HumanTask | null> {
  const db = getJarvisDb();
  if (!db) return null;
  const result = await db.execute({
    sql: "SELECT * FROM human_tasks WHERE id = ?",
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToHumanTask(result.rows[0] as Row);
}

/**
 * Apply a status transition + the matching timestamp/notes update.
 *
 * - accepted   → sets accepted_at if null
 * - in_progress → sets started_at if null
 * - done       → sets completed_at + completion_notes
 * - rejected   → sets completed_at + completion_notes (so we know when/why)
 * - blocked / open / stale → status only
 */
export async function updateHumanTaskStatus(
  id: number,
  newStatus: HumanTaskStatus,
  completionNotes?: string,
): Promise<void> {
  const db = getJarvisDb();
  if (!db) throw new Error("JARVIS DB unavailable");

  const sets: string[] = ["status = ?", "updated_at = datetime('now')"];
  const args: (string | number | null)[] = [newStatus];

  if (newStatus === "accepted") {
    sets.push("accepted_at = COALESCE(accepted_at, datetime('now'))");
  } else if (newStatus === "in_progress") {
    sets.push(
      "accepted_at = COALESCE(accepted_at, datetime('now'))",
      "started_at = COALESCE(started_at, datetime('now'))",
    );
  } else if (newStatus === "done") {
    sets.push(
      "accepted_at = COALESCE(accepted_at, datetime('now'))",
      "started_at = COALESCE(started_at, datetime('now'))",
      "completed_at = datetime('now')",
    );
    if (completionNotes !== undefined) {
      sets.push("completion_notes = ?");
      args.push(completionNotes);
    }
  } else if (newStatus === "rejected") {
    sets.push("completed_at = datetime('now')");
    if (completionNotes !== undefined) {
      sets.push("completion_notes = ?");
      args.push(completionNotes);
    }
  }

  args.push(id);
  await db.execute({
    sql: `UPDATE human_tasks SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
}

export async function listManagerArtifacts(opts: {
  projectId?: number;
  kinds?: ManagerArtifactKind[];
  status?: string;
  limit?: number;
} = {}): Promise<ManagerArtifact[]> {
  const db = getJarvisDb();
  if (!db) return [];

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.projectId !== undefined) {
    where.push("project_id = ?");
    args.push(opts.projectId);
  }
  if (opts.kinds && opts.kinds.length > 0) {
    const placeholders = opts.kinds.map(() => "?").join(",");
    where.push(`kind IN (${placeholders})`);
    args.push(...opts.kinds);
  }
  if (opts.status) {
    where.push("status = ?");
    args.push(opts.status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limitSql = opts.limit ? `LIMIT ${Math.max(1, Math.floor(opts.limit))}` : "";

  const sql = `
    SELECT *
    FROM manager_artifacts
    ${whereSql}
    ORDER BY created_at DESC, id DESC
    ${limitSql}
  `.trim();

  const result = await db.execute({ sql, args });
  return result.rows.map((r) => rowToArtifact(r as Row));
}

export async function listManagerSessions(
  projectId: number,
  limit = 10,
): Promise<ManagerSession[]> {
  const db = getJarvisDb();
  if (!db) return [];
  const result = await db.execute({
    sql: `SELECT * FROM manager_sessions
          WHERE project_id = ?
          ORDER BY started_at DESC, id DESC
          LIMIT ?`,
    args: [projectId, Math.max(1, Math.floor(limit))],
  });
  return result.rows.map((r) => rowToSession(r as Row));
}

export async function getLatestManagerSession(
  projectId: number,
): Promise<ManagerSession | null> {
  const sessions = await listManagerSessions(projectId, 1);
  return sessions[0] ?? null;
}

// ---------------------------------------------------------------------------
// Spawn a new manager session (fire-and-forget shell-out)
// ---------------------------------------------------------------------------

type StartSessionResult = {
  sessionId: number;
  taskId: number;
  workerName: string;
  projectId: number;
  projectName: string;
};

/**
 * Spawn `manager_runner.py start <project>` in a detached subprocess and
 * resolve once the runner has printed its JSON header (sessionId, taskId, …).
 *
 * We do NOT pass `--watch` — the main session_manager daemon picks up the
 * task_queue row and runs the worker. This call returns as soon as the
 * runner has written the manager_sessions / task_queue rows.
 */
export async function startManagerSession(
  projectId: number,
  openingMessage?: string,
  triggeredBy = "janicka-admin",
): Promise<StartSessionResult> {
  // Look up project name (manager_runner.py accepts name OR id; passing the
  // id keeps us decoupled from project rename).
  const projectName = await resolveProjectName(projectId);

  const args = [
    MANAGER_RUNNER_PATH,
    "start",
    projectName ?? String(projectId),
    "--triggered-by",
    triggeredBy,
  ];
  if (openingMessage && openingMessage.trim().length > 0) {
    args.push("--prompt", openingMessage.trim());
  }

  return new Promise<StartSessionResult>((resolve, reject) => {
    const child = spawn(PYTHON_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    let stdout = "";
    let stderr = "";
    let resolved = false;

    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      reject(
        new Error(
          `manager_runner timed out after 15s; stderr=${stderr.slice(0, 400)}`,
        ),
      );
    }, 15_000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      // The CLI prints one indented JSON block (multi-line). Try parse it.
      const parsed = tryParseRunnerOutput(stdout);
      if (parsed && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(parsed);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      const parsed = tryParseRunnerOutput(stdout);
      if (parsed) {
        resolve(parsed);
      } else {
        reject(
          new Error(
            `manager_runner exited code=${code}; stdout=${stdout.slice(0, 400)} stderr=${stderr.slice(0, 400)}`,
          ),
        );
      }
    });
  });
}

function tryParseRunnerOutput(stdout: string): StartSessionResult | null {
  if (!stdout.includes("session_id")) return null;
  // Accept either the indented JSON block alone or a stream of lines.
  // Find the first {...} JSON object in stdout.
  const start = stdout.indexOf("{");
  if (start < 0) return null;
  // Walk braces to find balanced end
  let depth = 0;
  for (let i = start; i < stdout.length; i++) {
    const c = stdout[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const candidate = stdout.slice(start, i + 1);
        try {
          const obj = JSON.parse(candidate) as {
            session_id?: number;
            task_id?: number;
            worker_name?: string;
            project_id?: number;
            project_name?: string;
          };
          if (
            typeof obj.session_id === "number" &&
            typeof obj.task_id === "number" &&
            typeof obj.worker_name === "string"
          ) {
            return {
              sessionId: obj.session_id,
              taskId: obj.task_id,
              workerName: obj.worker_name,
              projectId: obj.project_id ?? 0,
              projectName: obj.project_name ?? "",
            };
          }
        } catch {
          /* keep waiting for more output */
        }
        return null;
      }
    }
  }
  return null;
}

async function resolveProjectName(projectId: number): Promise<string | null> {
  const db = getJarvisDb();
  if (!db) return null;
  try {
    const result = await db.execute({
      sql: "SELECT name FROM projects WHERE id = ?",
      args: [projectId],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as Row;
    return asString(row.name);
  } catch {
    return null;
  }
}
