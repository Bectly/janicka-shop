/**
 * One-shot data copy from Turso (libsql) → local Postgres for Phase 2 cutover.
 *
 * Pre-reqs:
 *   - Postgres has the schema applied (see `prisma/schema.postgres.prisma`,
 *     run `npx prisma migrate deploy --schema=prisma/schema.postgres.prisma`
 *     first against an empty `janicka_shop` DB on Hetzner).
 *   - This script must run on a host that can reach BOTH Turso (HTTPS) and
 *     Postgres (5432). The Hetzner VPS is the natural choice — Postgres on
 *     localhost, Turso reachable over the public internet.
 *
 * Usage:
 *   TURSO_DATABASE_URL="libsql://..." \
 *   TURSO_AUTH_TOKEN="..." \
 *   POSTGRES_URL="postgresql://janicka:PASS@127.0.0.1:5432/janicka_shop" \
 *   npx tsx scripts/migrate-turso-to-postgres.ts [--reset] [--table=Product]
 *
 * Flags:
 *   --reset           TRUNCATE all destination tables before insert (CASCADE).
 *   --table=NAME      Only migrate one table (helpful for re-runs / debugging).
 *   --batch=N         Insert batch size (default 500).
 *   --dry             Read everything, report counts, skip writes.
 *
 * Behaviour:
 *   - Sets `session_replication_role = 'replica'` for the migration session so
 *     FK constraints don't bite during copy. Reset to `origin` at the end.
 *   - Copies in alphabetical order (FKs are off, so order doesn't matter).
 *   - Reports row counts per table + final parity check (Turso vs Postgres).
 */
import { createClient as createLibsql } from "@libsql/client";
import { Client as PgClient } from "pg";

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const PG_URL = process.env.POSTGRES_URL;

if (!TURSO_URL || !TURSO_TOKEN || !PG_URL) {
  console.error(
    "[fatal] missing env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, POSTGRES_URL",
  );
  process.exit(1);
}

const args = new Map<string, string | boolean>();
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, "").split("=");
  args.set(k, v ?? true);
}

const RESET = args.has("reset");
const DRY = args.has("dry");
const ONLY_TABLE = args.get("table") as string | undefined;
const BATCH = Number(args.get("batch") ?? 500);

// Source of truth for table list. Order is irrelevant when FKs are off, but
// kept alphabetical for stable logs.
const TABLES = [
  "AbandonedCart",
  "Admin",
  "BackInStockSubscription",
  "BrowseAbandonment",
  "CampaignLog",
  "CampaignSendLock",
  "Category",
  "Collection",
  "CreditNote",
  "Customer",
  "CustomerAddress",
  "CustomerAuditLog",
  "CustomerWishlist",
  "DevPick",
  "EmailAttachment",
  "EmailDedupLog",
  "EmailMessage",
  "EmailThread",
  "Invoice",
  "JarvisConsoleLog",
  "ManagerArtifact",
  "ManagerComment",
  "ManagerSession",
  "ManagerTask",
  "ManagerThread",
  "ManagerThreadAction",
  "ManagerThreadMessage",
  "NewsletterSubscriber",
  "Order",
  "OrderItem",
  "PriceHistory",
  "Product",
  "ProductDraft",
  "ProductDraftBatch",
  "ProductNotifyRequest",
  "ReferralCode",
  "Return",
  "ReturnItem",
  "ShopSettings",
  "SiteSetting",
  "StoreCredit",
  "Supplier",
  "SupplierBundle",
  "SupplierBundleLine",
  "SupplierPricelist",
  "SupplierPricelistItem",
  "WishlistSubscription",
];

const turso = createLibsql({ url: TURSO_URL, authToken: TURSO_TOKEN });
const pg = new PgClient({ connectionString: PG_URL });

function quote(ident: string) {
  // Postgres + Prisma both quote identifiers; reject any name containing a
  // double-quote so we can splice safely without escaping.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) {
    throw new Error(`refusing to quote suspicious identifier: ${ident}`);
  }
  return `"${ident}"`;
}

// SQLite stores booleans as 0/1 ints. The Prisma postgres provider expects
// real booleans. We discover boolean columns by inspecting the Postgres
// information_schema and coerce on the way in.
async function getBooleanColumns(table: string): Promise<Set<string>> {
  const r = await pg.query(
    `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND data_type = 'boolean'`,
    [table],
  );
  return new Set(r.rows.map((row) => row.column_name as string));
}

// SQLite stores DateTime as epoch ms int (Prisma libsql adapter convention).
// Postgres timestamp columns need ISO strings or Date objects.
async function getTimestampColumns(table: string): Promise<Set<string>> {
  const r = await pg.query(
    `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
         AND data_type IN ('timestamp without time zone','timestamp with time zone','date')`,
    [table],
  );
  return new Set(r.rows.map((row) => row.column_name as string));
}

async function getColumns(table: string): Promise<string[]> {
  const r = await pg.query(
    `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
    [table],
  );
  return r.rows.map((row) => row.column_name as string);
}

async function tursoCount(table: string): Promise<number> {
  const r = await turso.execute(`SELECT COUNT(*) AS c FROM "${table}"`);
  return Number(r.rows[0]?.c ?? 0);
}

async function pgCount(table: string): Promise<number> {
  const r = await pg.query(`SELECT COUNT(*)::int AS c FROM ${quote(table)}`);
  return r.rows[0]?.c ?? 0;
}

function coerceValue(v: unknown, isBool: boolean, isTimestamp = false): unknown {
  if (v === null || v === undefined) return null;
  if (isTimestamp) {
    // libsql returns epoch ms (number/bigint/string) or ISO strings depending on column.
    if (v instanceof Date) return v;
    if (typeof v === "number") return new Date(v);
    if (typeof v === "bigint") return new Date(Number(v));
    if (typeof v === "string") {
      // Numeric string → epoch ms; otherwise pass through (ISO).
      if (/^\d+$/.test(v)) return new Date(Number(v));
      return v;
    }
    return v;
  }
  if (isBool) {
    // libsql returns 0/1 numbers (or sometimes string "0"/"1")
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
    return Boolean(v);
  }
  // libsql returns BigInt for INTEGER columns sometimes; pg accepts string/number
  if (typeof v === "bigint") return v.toString();
  return v;
}

async function migrateTable(table: string): Promise<{
  source: number;
  copied: number;
  dest: number;
}> {
  const sourceCount = await tursoCount(table);
  const cols = await getColumns(table);
  const boolCols = await getBooleanColumns(table);
  const tsCols = await getTimestampColumns(table);

  if (cols.length === 0) {
    console.log(`[skip] ${table}: no columns in destination (table missing?)`);
    return { source: sourceCount, copied: 0, dest: 0 };
  }

  // NOTE: per-table TRUNCATE CASCADE was removed because cascading wiped
  // already-populated tables (e.g. truncating Product cascaded into
  // PriceHistory which had been migrated alphabetically just before).
  // Bulk reset is now done up-front in main() before the loop starts.

  let offset = 0;
  let copied = 0;
  while (offset < sourceCount) {
    const r = await turso.execute({
      sql: `SELECT ${cols.map((c) => `"${c}"`).join(", ")} FROM "${table}" LIMIT ${BATCH} OFFSET ${offset}`,
      args: [],
    });
    if (r.rows.length === 0) break;

    if (!DRY) {
      // Single multi-row INSERT per batch with parameterised values.
      const placeholders: string[] = [];
      const values: unknown[] = [];
      let p = 1;
      for (const row of r.rows) {
        const ph: string[] = [];
        for (const c of cols) {
          values.push(coerceValue((row as Record<string, unknown>)[c], boolCols.has(c), tsCols.has(c)));
          ph.push(`$${p++}`);
        }
        placeholders.push(`(${ph.join(", ")})`);
      }
      const insertSql = `INSERT INTO ${quote(table)} (${cols.map(quote).join(", ")}) VALUES ${placeholders.join(", ")} ON CONFLICT DO NOTHING`;
      await pg.query(insertSql, values);
    }

    copied += r.rows.length;
    offset += r.rows.length;
    if (r.rows.length < BATCH) break;
  }

  const destCount = DRY ? 0 : await pgCount(table);
  return { source: sourceCount, copied, dest: destCount };
}

async function main() {
  await pg.connect();
  console.log(`[info] connected to ${PG_URL?.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`[info] mode: ${DRY ? "DRY-RUN" : RESET ? "RESET+COPY" : "APPEND-COPY"}`);

  if (!DRY) {
    await pg.query("SET session_replication_role = 'replica'");
  }

  if (RESET && !DRY) {
    // One-shot bulk truncate so cascades don't wipe tables we'll populate later.
    const tableList = TABLES.map(quote).join(", ");
    await pg.query(`TRUNCATE TABLE ${tableList} CASCADE`);
    console.log(`[info] bulk-truncated ${TABLES.length} tables`);
  }

  const targetTables = ONLY_TABLE ? [ONLY_TABLE] : TABLES;
  const report: Array<{ table: string; source: number; copied: number; dest: number; ok: boolean }> = [];

  for (const t of targetTables) {
    const t0 = Date.now();
    try {
      const r = await migrateTable(t);
      const ok = DRY || r.dest === r.source;
      report.push({ table: t, ...r, ok });
      const ms = Date.now() - t0;
      const flag = ok ? "ok" : "DRIFT";
      console.log(
        `[${flag}] ${t.padEnd(28)} src=${String(r.source).padStart(6)} copied=${String(r.copied).padStart(6)} dest=${String(r.dest).padStart(6)}  ${ms}ms`,
      );
    } catch (e) {
      console.error(`[fail] ${t}:`, (e as Error).message);
      report.push({ table: t, source: 0, copied: 0, dest: 0, ok: false });
    }
  }

  if (!DRY) {
    await pg.query("SET session_replication_role = 'origin'");
  }

  const totalSource = report.reduce((a, r) => a + r.source, 0);
  const totalDest = report.reduce((a, r) => a + r.dest, 0);
  const drift = report.filter((r) => !r.ok);
  console.log(`\n=== SUMMARY ===`);
  console.log(`tables:  ${report.length}`);
  console.log(`source:  ${totalSource} rows`);
  console.log(`dest:    ${totalDest} rows`);
  console.log(`drift:   ${drift.length} tables`);
  if (drift.length > 0) {
    console.log(`\nTables with drift:`);
    for (const d of drift) {
      console.log(`  - ${d.table}: src=${d.source} dest=${d.dest}`);
    }
    process.exitCode = 1;
  }

  await pg.end();
  await turso.close();
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
