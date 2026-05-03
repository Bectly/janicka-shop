#!/usr/bin/env python3
"""
Phase 4 — One-off backfill: JARVIS sqlite -> Postgres ManagerSession/ManagerArtifact.

Syncs historical drift (default cutoff 2026-04-25 → today) for project_id=15
that accumulated before dual-write went live.

Idempotency: relies on Phase 2 columns
  - "ManagerSession"."jarvisSessionId"   INTEGER UNIQUE NULL
  - "ManagerArtifact"."jarvisArtifactId" INTEGER UNIQUE NULL
Each insert carries the source sqlite id so re-runs become no-ops.

Usage:
  scripts/backfill-manager-sync.py                    # dry-run (default)
  scripts/backfill-manager-sync.py --live             # apply
  scripts/backfill-manager-sync.py --live --resume-from 38 --chunk-size 50
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_batch
except ImportError:
    sys.stderr.write(
        "Missing psycopg2. Install via: pip3 install --user psycopg2-binary\n"
    )
    sys.exit(1)


SQLITE_PATH = Path.home() / ".claude" / "jarvis-gym" / "jarvis.db"
PROJECT_ID = 15
CUTOFF_DATE = "2026-04-25"
ARTIFACT_KINDS = ("task_human", "report")
DEFAULT_DSN = (
    "postgresql://janicka:BntJP6OY8LQqimjrhcqOQOOcISDfA@127.0.0.1:5433/janicka_shop"
)


def gen_session_id(jarvis_id: int) -> str:
    return f"jrvs_{jarvis_id:08d}"


def gen_artifact_id(jarvis_id: int) -> str:
    return f"jrva_{jarvis_id:08d}"


def has_column(pg_conn, table: str, column: str) -> bool:
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
            """,
            (table, column),
        )
        return cur.fetchone() is not None


def fetch_sessions(sqlite_conn, resume_from: int) -> list[sqlite3.Row]:
    cur = sqlite_conn.cursor()
    cur.execute(
        """
        SELECT id, project_id, worker_name, task_id, status, triggered_by,
               started_at, ended_at, end_reason, summary_md, cost_usd,
               tokens_total, claude_session_id
          FROM manager_sessions
         WHERE project_id = ?
           AND started_at >= ?
           AND id >= ?
         ORDER BY id
        """,
        (PROJECT_ID, CUTOFF_DATE, resume_from),
    )
    return cur.fetchall()


def fetch_artifacts(sqlite_conn, resume_from: int) -> list[sqlite3.Row]:
    placeholders = ",".join("?" * len(ARTIFACT_KINDS))
    cur = sqlite_conn.cursor()
    cur.execute(
        f"""
        SELECT id, session_id, project_id, kind, title, body_md, body_json,
               parent_artifact_id, status, mood, created_at, accepted_at,
               accepted_by
          FROM manager_artifacts
         WHERE project_id = ?
           AND kind IN ({placeholders})
           AND created_at >= ?
           AND id >= ?
         ORDER BY id
        """,
        (PROJECT_ID, *ARTIFACT_KINDS, CUTOFF_DATE, resume_from),
    )
    return cur.fetchall()


def existing_pg_ids(pg_conn, table: str, column: str, ids: list[int]) -> set[int]:
    if not ids:
        return set()
    with pg_conn.cursor() as cur:
        cur.execute(
            f'SELECT "{column}" FROM "{table}" WHERE "{column}" = ANY(%s)',
            (ids,),
        )
        return {row[0] for row in cur.fetchall()}


def build_session_map(pg_conn) -> dict[int, str]:
    with pg_conn.cursor() as cur:
        cur.execute(
            'SELECT id, "jarvisSessionId" FROM "ManagerSession" '
            'WHERE "jarvisSessionId" IS NOT NULL'
        )
        return {jarvis_id: pg_id for pg_id, jarvis_id in cur.fetchall()}


SESSION_INSERT_SQL = """
INSERT INTO "ManagerSession" (
    id, "projectId", "workerName", "taskId", status, "triggeredBy",
    "startedAt", "endedAt", "endReason", "summaryMd", "costUsd",
    "tokensTotal", "claudeSessionId", "jarvisSessionId"
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
)
ON CONFLICT ("jarvisSessionId") DO NOTHING
"""

ARTIFACT_INSERT_SQL = """
INSERT INTO "ManagerArtifact" (
    id, "sessionId", "projectId", kind, title, "bodyMd", "bodyJson",
    "parentArtifactId", status, mood, "createdAt", "acceptedAt",
    "acceptedBy", "jarvisArtifactId"
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
)
ON CONFLICT ("jarvisArtifactId") DO NOTHING
"""


def insert_sessions(pg_conn, rows: list[sqlite3.Row], chunk_size: int) -> int:
    inserted = 0
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        params = [
            (
                gen_session_id(r["id"]),
                r["project_id"],
                r["worker_name"],
                r["task_id"],
                r["status"],
                r["triggered_by"],
                r["started_at"],
                r["ended_at"],
                r["end_reason"],
                r["summary_md"],
                r["cost_usd"],
                r["tokens_total"],
                r["claude_session_id"],
                r["id"],
            )
            for r in chunk
        ]
        with pg_conn:
            with pg_conn.cursor() as cur:
                execute_batch(cur, SESSION_INSERT_SQL, params, page_size=chunk_size)
                cur.execute(
                    'SELECT COUNT(*) FROM "ManagerSession" '
                    'WHERE "jarvisSessionId" = ANY(%s)',
                    ([r["id"] for r in chunk],),
                )
                inserted = cur.fetchone()[0]
        print(
            f"  sessions: committed {min(start + chunk_size, len(rows))}/{len(rows)}",
            flush=True,
        )
    return inserted


def insert_artifacts(
    pg_conn,
    rows: list[sqlite3.Row],
    chunk_size: int,
    session_map: dict[int, str],
) -> tuple[int, int]:
    skipped = 0
    inserted = 0
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        params: list[tuple] = []
        for r in chunk:
            pg_session_id = session_map.get(r["session_id"])
            if pg_session_id is None:
                sys.stderr.write(
                    f"  WARN: artifact id={r['id']} → session_id={r['session_id']} "
                    "missing in PG; skipping (run sessions backfill first).\n"
                )
                skipped += 1
                continue
            parent_pg_id = (
                gen_artifact_id(r["parent_artifact_id"])
                if r["parent_artifact_id"] is not None
                else None
            )
            params.append(
                (
                    gen_artifact_id(r["id"]),
                    pg_session_id,
                    r["project_id"],
                    r["kind"],
                    r["title"],
                    r["body_md"],
                    r["body_json"],
                    parent_pg_id,
                    r["status"],
                    r["mood"],
                    r["created_at"],
                    r["accepted_at"],
                    r["accepted_by"],
                    r["id"],
                )
            )
        if params:
            with pg_conn:
                with pg_conn.cursor() as cur:
                    execute_batch(
                        cur, ARTIFACT_INSERT_SQL, params, page_size=chunk_size
                    )
                    cur.execute(
                        'SELECT COUNT(*) FROM "ManagerArtifact" '
                        'WHERE "jarvisArtifactId" = ANY(%s)',
                        ([p[-1] for p in params],),
                    )
                    inserted += cur.fetchone()[0]
        print(
            f"  artifacts: committed {min(start + chunk_size, len(rows))}/{len(rows)}",
            flush=True,
        )
    return inserted, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--live",
        action="store_true",
        help="Apply inserts. Without this flag the script runs in dry-run mode.",
    )
    parser.add_argument(
        "--resume-from",
        type=int,
        default=0,
        metavar="JARVIS_ID",
        help="Process only rows with sqlite id >= this value.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=50,
        help="Rows per transaction (default 50).",
    )
    parser.add_argument(
        "--dsn",
        default=os.environ.get("BACKFILL_DSN", DEFAULT_DSN),
        help="Postgres DSN (env BACKFILL_DSN overrides default).",
    )
    parser.add_argument("--sqlite", default=str(SQLITE_PATH))
    args = parser.parse_args()

    dry_run = not args.live

    sqlite_path = Path(args.sqlite)
    if not sqlite_path.exists():
        sys.stderr.write(f"sqlite db not found: {sqlite_path}\n")
        return 1

    sqlite_conn = sqlite3.connect(str(sqlite_path))
    sqlite_conn.row_factory = sqlite3.Row

    try:
        pg_conn = psycopg2.connect(args.dsn)
    except psycopg2.OperationalError as exc:
        sys.stderr.write(f"postgres connect failed: {exc}\n")
        sys.stderr.write(
            "Hint: check `systemctl --user status jarvis-postgres-tunnel.service`.\n"
        )
        return 1

    has_sess_col = has_column(pg_conn, "ManagerSession", "jarvisSessionId")
    has_art_col = has_column(pg_conn, "ManagerArtifact", "jarvisArtifactId")

    sessions = fetch_sessions(sqlite_conn, args.resume_from)
    artifacts = fetch_artifacts(sqlite_conn, args.resume_from)

    sess_ids = [r["id"] for r in sessions]
    art_ids = [r["id"] for r in artifacts]

    existing_sess = (
        existing_pg_ids(pg_conn, "ManagerSession", "jarvisSessionId", sess_ids)
        if has_sess_col
        else set()
    )
    existing_art = (
        existing_pg_ids(pg_conn, "ManagerArtifact", "jarvisArtifactId", art_ids)
        if has_art_col
        else set()
    )

    new_sessions = [r for r in sessions if r["id"] not in existing_sess]
    new_artifacts = [r for r in artifacts if r["id"] not in existing_art]

    print(f"Source: sqlite {sqlite_path}")
    print(f"Target: {args.dsn.rsplit('@', 1)[-1]}")
    print(
        f"Filter: project_id={PROJECT_ID}, since={CUTOFF_DATE}, "
        f"artifact kinds={list(ARTIFACT_KINDS)}, resume_from={args.resume_from}"
    )
    print(
        f"Phase 2 idempotency cols: jarvisSessionId={has_sess_col}, "
        f"jarvisArtifactId={has_art_col}"
    )
    print(
        f"Source rows:    {len(sessions):>4} sessions, {len(artifacts):>4} artifacts"
    )
    print(
        f"Already in PG:  {len(existing_sess):>4} sessions, "
        f"{len(existing_art):>4} artifacts"
    )
    print(
        f"Would insert:   {len(new_sessions):>4} sessions, "
        f"{len(new_artifacts):>4} artifacts"
    )

    if dry_run:
        print("[DRY-RUN] No writes. Re-run with --live to apply.")
        pg_conn.close()
        sqlite_conn.close()
        return 0

    if not (has_sess_col and has_art_col):
        sys.stderr.write(
            "ERROR: Phase 2 migration not applied; refusing --live.\n"
            "  ManagerSession.jarvisSessionId   present: "
            f"{has_sess_col}\n"
            "  ManagerArtifact.jarvisArtifactId present: "
            f"{has_art_col}\n"
            "Add the INTEGER UNIQUE columns first.\n"
        )
        pg_conn.close()
        sqlite_conn.close()
        return 2

    inserted_sess = insert_sessions(pg_conn, new_sessions, args.chunk_size)
    session_map = build_session_map(pg_conn)
    inserted_art, skipped_art = insert_artifacts(
        pg_conn, new_artifacts, args.chunk_size, session_map
    )

    print(
        f"Done. Inserted: {inserted_sess} sessions, "
        f"{inserted_art} artifacts (skipped {skipped_art} orphan artifacts)."
    )

    pg_conn.close()
    sqlite_conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
