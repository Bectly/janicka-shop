/**
 * sync-product-data-to-turso.ts — Copy specific Product columns from dev.db to Turso.
 *
 * Schema sync (sync-turso.ts) ensures columns exist in Turso, but DATA populated
 * by restore/backfill scripts stays local. Use this when a script populated new
 * columns in dev.db and that data needs to reach production.
 *
 * Usage:
 *   tsx scripts/sync-product-data-to-turso.ts --fields=defectsNote,defectImages
 *   tsx scripts/sync-product-data-to-turso.ts --fields=defectsNote --dry
 *   tsx scripts/sync-product-data-to-turso.ts --fields=defectsNote --only-empty  # only update where Turso value is NULL/default
 *
 * Matches rows by Product.id. Products present in dev.db but missing in Turso
 * are skipped with a warning (use Prisma seeding / admin CRUD to create them).
 */

import { createClient, type Client, type InValue } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ALLOWED_FIELDS = new Set([
  "name",
  "description",
  "price",
  "compareAt",
  "brand",
  "condition",
  "sizes",
  "colors",
  "images",
  "measurements",
  "fitNote",
  "videoUrl",
  "defectsNote",
  "defectImages",
  "featured",
  "active",
  "sold",
  "vintedId",
  "originalDescription",
  "originalVintedData",
  "metaTitle",
  "metaDescription",
  "internalNote",
]);

type MatchKey = "id" | "sku" | "slug" | "vintedId";

type Args = {
  fields: string[];
  dry: boolean;
  onlyEmpty: boolean;
  matchBy: MatchKey;
};

const VALID_MATCH_KEYS: ReadonlySet<MatchKey> = new Set(["id", "sku", "slug", "vintedId"]);

function parseArgs(argv: string[]): Args {
  const args: Args = { fields: [], dry: false, onlyEmpty: false, matchBy: "id" };
  for (const a of argv.slice(2)) {
    if (a === "--dry") args.dry = true;
    else if (a === "--only-empty") args.onlyEmpty = true;
    else if (a.startsWith("--fields=")) {
      args.fields = a
        .slice("--fields=".length)
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
    } else if (a.startsWith("--match-by=")) {
      const key = a.slice("--match-by=".length).trim() as MatchKey;
      if (!VALID_MATCH_KEYS.has(key)) {
        throw new Error(`--match-by must be one of: ${[...VALID_MATCH_KEYS].join(", ")}`);
      }
      args.matchBy = key;
    }
  }
  return args;
}

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
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
    // optional
  }
}

function isDefaultOrEmpty(field: string, value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") {
    if (value === "") return true;
    if ((field === "defectImages" || field === "images" || field === "sizes" || field === "colors") && value === "[]") return true;
    if (field === "measurements" && value === "{}") return true;
  }
  return false;
}

export async function syncProductData(opts: Args): Promise<void> {
  for (const f of opts.fields) {
    if (!ALLOWED_FIELDS.has(f)) {
      throw new Error(`Field "${f}" is not allowed. Allowed: ${[...ALLOWED_FIELDS].join(", ")}`);
    }
  }
  if (opts.fields.length === 0) {
    throw new Error("No fields specified. Use --fields=col1,col2");
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (!tursoUrl || !tursoToken) {
    throw new Error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN");
  }

  const devDbPath = resolve(process.cwd(), "prisma/dev.db");
  const local: Client = createClient({ url: `file:${devDbPath}` });
  const remote: Client = createClient({
    url: tursoUrl.trim(),
    authToken: tursoToken.trim(),
  });

  const matchCol = opts.matchBy;
  const fieldList = opts.fields.map((f) => `"${f}"`).join(", ");
  console.log(`→ Reading dev.db: "${matchCol}", ${fieldList}`);
  const devRes = await local.execute(
    `SELECT "${matchCol}" AS _key, ${fieldList} FROM Product WHERE "${matchCol}" IS NOT NULL`
  );
  console.log(`  ${devRes.rows.length} products in dev.db`);

  const remoteRes = await remote.execute(
    `SELECT "${matchCol}" AS _key${opts.onlyEmpty ? ", " + fieldList : ""} FROM Product WHERE "${matchCol}" IS NOT NULL`
  );
  const remoteByKey = new Map<string, Record<string, unknown>>();
  for (const row of remoteRes.rows) {
    remoteByKey.set(String(row._key), row as unknown as Record<string, unknown>);
  }
  console.log(`  ${remoteByKey.size} products in Turso (matched on ${matchCol})`);

  const setClause = opts.fields.map((f) => `"${f}" = ?`).join(", ");
  const updateSql = `UPDATE Product SET ${setClause} WHERE "${matchCol}" = ?`;

  let updated = 0;
  let skippedMissing = 0;
  let skippedEmpty = 0;
  let failed = 0;

  for (const row of devRes.rows) {
    const key = String((row as unknown as Record<string, unknown>)._key);
    const remoteRow = remoteByKey.get(key);
    if (!remoteRow) {
      skippedMissing += 1;
      continue;
    }

    // Skip row if every dev field is default/empty (nothing to copy).
    const hasAnyValue = opts.fields.some(
      (f) => !isDefaultOrEmpty(f, (row as unknown as Record<string, unknown>)[f])
    );
    if (!hasAnyValue) {
      skippedEmpty += 1;
      continue;
    }

    if (opts.onlyEmpty) {
      // Only update if Turso side is empty/default for at least one field AND dev has value.
      const needsAny = opts.fields.some(
        (f) =>
          isDefaultOrEmpty(f, remoteRow[f]) &&
          !isDefaultOrEmpty(f, (row as unknown as Record<string, unknown>)[f])
      );
      if (!needsAny) {
        skippedEmpty += 1;
        continue;
      }
    }

    const values: InValue[] = opts.fields.map(
      (f) => (row as unknown as Record<string, InValue>)[f] ?? null
    );

    if (opts.dry) {
      if (updated < 3) {
        console.log(`  DRY UPDATE ${matchCol}=${key}:`, Object.fromEntries(opts.fields.map((f, i) => [f, values[i]])));
      }
      updated += 1;
      continue;
    }

    try {
      await remote.execute({ sql: updateSql, args: [...values, key] });
      updated += 1;
      if (updated % 25 === 0) console.log(`  …${updated} updated`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${matchCol}=${key}: ${msg}`);
    }
  }

  local.close();
  remote.close();

  console.log(`\n${opts.dry ? "[DRY] " : ""}updated=${updated} skipped_missing=${skippedMissing} skipped_empty=${skippedEmpty} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnvLocal();
  const opts = parseArgs(process.argv);
  syncProductData(opts).catch((err) => {
    console.error("✗ sync-product-data-to-turso failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
