/**
 * sync-turso.ts — Diff local dev.db against Turso and apply missing DDL.
 *
 * Flow:
 *   1. Read schema (tables, columns, indexes) from prisma/dev.db
 *   2. Read same from Turso over HTTP via @libsql/client
 *   3. Diff and emit SQL:
 *      - missing table  → CREATE TABLE from sqlite_master.sql
 *      - missing column → ALTER TABLE ADD COLUMN (SQLite only supports ADD)
 *      - missing index  → CREATE INDEX IF NOT EXISTS
 *   4. Dry-run (--dry) prints SQL and exits. Default mode applies it.
 *
 * Never destructive: columns/tables present in Turso but not dev.db emit a
 * warning only. Columns starting with `_` (e.g. `_prisma_migrations`) are
 * skipped. NOT NULL additions without a default are skipped with a warning
 * because SQLite rejects them on non-empty tables.
 *
 * Env: reads .env.local for TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 */

import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type ColumnInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type SchemaObject = {
  type: "table" | "index";
  name: string;
  tbl_name: string;
  sql: string | null;
};

const DRY_RUN = process.argv.includes("--dry");
// npm scripts run from the package root, so cwd is project root.
const PROJECT_ROOT = process.cwd();

function loadEnvLocal(): void {
  const envPath = resolve(PROJECT_ROOT, ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local optional — env may already be set
  }
}

function isInternalTable(name: string): boolean {
  return name.startsWith("_") || name.startsWith("sqlite_");
}

async function readSchema(client: Client): Promise<{
  tables: Map<string, { sql: string; columns: Map<string, ColumnInfo> }>;
  indexes: Map<string, { sql: string; tbl_name: string }>;
}> {
  const objectsRes = await client.execute(
    "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','index') ORDER BY type, name"
  );

  const tables = new Map<
    string,
    { sql: string; columns: Map<string, ColumnInfo> }
  >();
  const indexes = new Map<string, { sql: string; tbl_name: string }>();

  for (const row of objectsRes.rows as unknown as SchemaObject[]) {
    if (!row.name || isInternalTable(row.name)) continue;
    if (isInternalTable(row.tbl_name)) continue;
    if (!row.sql) continue; // auto-created indexes have null sql — skip

    if (row.type === "table") {
      // Fetch column info for this table
      const info = await client.execute(`PRAGMA table_info("${row.name}")`);
      const columns = new Map<string, ColumnInfo>();
      for (const colRow of info.rows) {
        const col: ColumnInfo = {
          name: String(colRow.name),
          type: String(colRow.type ?? ""),
          notnull: Number(colRow.notnull ?? 0),
          dflt_value:
            colRow.dflt_value === null || colRow.dflt_value === undefined
              ? null
              : String(colRow.dflt_value),
          pk: Number(colRow.pk ?? 0),
        };
        columns.set(col.name, col);
      }
      tables.set(row.name, { sql: row.sql, columns });
    } else if (row.type === "index") {
      indexes.set(row.name, { sql: row.sql, tbl_name: row.tbl_name });
    }
  }

  return { tables, indexes };
}

type Statement = { sql: string; note?: string };

function buildAddColumnSql(tableName: string, col: ColumnInfo): Statement {
  const parts = [`ALTER TABLE "${tableName}" ADD COLUMN "${col.name}"`];
  if (col.type) parts.push(col.type);
  if (col.dflt_value !== null) parts.push(`DEFAULT ${col.dflt_value}`);
  // NOT NULL without DEFAULT fails on non-empty tables in SQLite — skip at diff stage.
  if (col.notnull && col.dflt_value !== null) parts.push("NOT NULL");
  return { sql: parts.join(" ") };
}

function ensureIfNotExists(sql: string, kind: "TABLE" | "INDEX"): string {
  // sqlite_master stores CREATE TABLE / CREATE UNIQUE INDEX / CREATE INDEX
  // Insert IF NOT EXISTS to make statements idempotent.
  const patterns: Array<[RegExp, string]> = [
    [/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE TABLE IF NOT EXISTS "],
    [
      /^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i,
      "CREATE UNIQUE INDEX IF NOT EXISTS ",
    ],
    [/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE INDEX IF NOT EXISTS "],
  ];
  for (const [re, replacement] of patterns) {
    if (re.test(sql)) return sql.replace(re, replacement);
  }
  void kind;
  return sql;
}

async function main() {
  loadEnvLocal();

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error(
      "✗ Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (looked in .env.local + environment)"
    );
    process.exit(1);
  }

  const devDbPath = resolve(PROJECT_ROOT, "prisma/dev.db");
  const localClient = createClient({ url: `file:${devDbPath}` });
  const remoteClient = createClient({
    url: tursoUrl.trim(),
    authToken: tursoToken.trim(),
  });

  console.log(`→ Reading local schema: ${devDbPath}`);
  const local = await readSchema(localClient);
  console.log(
    `  ${local.tables.size} tables, ${local.indexes.size} indexes (non-internal)`
  );

  console.log(`→ Reading Turso schema: ${new URL(tursoUrl).host}`);
  const remote = await readSchema(remoteClient);
  console.log(
    `  ${remote.tables.size} tables, ${remote.indexes.size} indexes (non-internal)`
  );

  const statements: Statement[] = [];
  const warnings: string[] = [];

  // Tables present in dev but missing in Turso
  for (const [name, def] of local.tables) {
    if (!remote.tables.has(name)) {
      statements.push({
        sql: ensureIfNotExists(def.sql.trim(), "TABLE"),
        note: `new table: ${name}`,
      });
    }
  }

  // Columns: for tables in both, find columns in local but not remote
  for (const [tableName, localTable] of local.tables) {
    const remoteTable = remote.tables.get(tableName);
    if (!remoteTable) continue; // handled above
    for (const [colName, col] of localTable.columns) {
      if (!remoteTable.columns.has(colName)) {
        if (col.notnull && col.dflt_value === null) {
          warnings.push(
            `⚠  Skipping column "${tableName}"."${colName}" — NOT NULL with no DEFAULT ` +
              `(SQLite rejects ADD COLUMN NOT NULL on non-empty tables). ` +
              `Add a default in schema.prisma or backfill manually.`
          );
          continue;
        }
        statements.push({
          ...buildAddColumnSql(tableName, col),
          note: `new column: ${tableName}.${colName}`,
        });
      }
    }
  }

  // Indexes present in dev but missing in Turso
  for (const [name, def] of local.indexes) {
    if (!remote.indexes.has(name)) {
      statements.push({
        sql: ensureIfNotExists(def.sql.trim(), "INDEX"),
        note: `new index: ${name}`,
      });
    }
  }

  // Non-destructive inverse warnings
  for (const name of remote.tables.keys()) {
    if (!local.tables.has(name)) {
      warnings.push(
        `⚠  Table "${name}" exists in Turso but not dev.db (not deleting — manual action if intended).`
      );
    }
  }
  for (const [tableName, remoteTable] of remote.tables) {
    const localTable = local.tables.get(tableName);
    if (!localTable) continue;
    for (const colName of remoteTable.columns.keys()) {
      if (!localTable.columns.has(colName)) {
        warnings.push(
          `⚠  Column "${tableName}"."${colName}" exists in Turso but not dev.db (not deleting).`
        );
      }
    }
  }
  for (const name of remote.indexes.keys()) {
    if (!local.indexes.has(name)) {
      warnings.push(
        `⚠  Index "${name}" exists in Turso but not dev.db (not deleting).`
      );
    }
  }

  for (const w of warnings) console.log(w);

  if (statements.length === 0) {
    console.log("✓ Turso schema in sync with dev.db");
    localClient.close();
    remoteClient.close();
    process.exit(0);
  }

  console.log(`\n${statements.length} statement(s) to apply:\n`);
  for (const s of statements) {
    console.log(`  -- ${s.note}`);
    console.log(`  ${s.sql};\n`);
  }

  if (DRY_RUN) {
    console.log("— dry run, nothing applied —");
    localClient.close();
    remoteClient.close();
    process.exit(0);
  }

  let failed = 0;
  for (const s of statements) {
    try {
      await remoteClient.execute(s.sql);
      console.log(`✓ ${s.note}`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${s.note}: ${msg}`);
    }
  }

  localClient.close();
  remoteClient.close();

  if (failed > 0) {
    console.error(`\n${failed} statement(s) failed.`);
    process.exit(1);
  }

  console.log("\n✓ Turso schema now matches dev.db");
}

main().catch((err) => {
  console.error("✗ sync-turso failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
