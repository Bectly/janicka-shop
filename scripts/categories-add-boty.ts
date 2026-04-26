/**
 * categories-add-boty.ts — Create the "Boty" (shoes) category and reclassify
 * existing footwear products into it. Also moves stray scarves out of
 * "Bundy & Kabáty" into "Doplňky" (task #627).
 *
 *   npx tsx scripts/categories-add-boty.ts                   # dry-run, dev.db
 *   npx tsx scripts/categories-add-boty.ts --write           # apply, dev.db
 *   npx tsx scripts/categories-add-boty.ts --turso           # dry-run, Turso
 *   npx tsx scripts/categories-add-boty.ts --turso --write   # apply, Turso
 */

import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BOTY_NAME = "Boty";
const BOTY_SLUG = "boty";
const BOTY_DESCRIPTION = "Lodičky, tenisky, kotníčky — každý pár unikát";
const BOTY_SORT_ORDER = 5;
const DOPLNKY_SORT_ORDER = 6;

/**
 * Names of products that should live in "Boty". Hand-curated from the
 * current dev.db catalog (Cycle #4971). Only matches if name contains the
 * fragment (case-insensitive) AND the product is not already in "Boty".
 */
const SHOE_NAME_FRAGMENTS = [
  "Motorkářské boty",
  "Klínové lodičky",
  "Puma boty",
  "Reebok sportovní boty",
  "Graceland letní boty",
];

const SCARF_NAME_FRAGMENTS = [
  "Černo-bílá kostkovaná šála",
];

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

async function getCategoryId(client: Client, slug: string): Promise<string | null> {
  const res = await client.execute({
    sql: "SELECT id FROM Category WHERE slug = ?",
    args: [slug],
  });
  if (res.rows.length === 0) return null;
  return String((res.rows[0] as unknown as { id: string }).id);
}

function newCuid(): string {
  // Lightweight cuid-ish identifier (collision-safe enough for one-off insert).
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

async function ensureBotyCategory(
  client: Client,
  write: boolean,
  label: string,
): Promise<string> {
  const existingId = await getCategoryId(client, BOTY_SLUG);
  if (existingId) {
    console.log(`  [${label}] "Boty" category already exists: ${existingId}`);
    return existingId;
  }
  const id = newCuid();
  console.log(`  [${label}] ${write ? "CREATE" : "DRY"} "Boty" category id=${id}`);
  if (write) {
    const now = new Date().toISOString();
    await client.execute({
      sql:
        'INSERT INTO Category (id, name, slug, description, sortOrder, createdAt, updatedAt) ' +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [id, BOTY_NAME, BOTY_SLUG, BOTY_DESCRIPTION, BOTY_SORT_ORDER, now, now],
    });
    // Bump Doplňky sortOrder so it sits after Boty in nav.
    await client.execute({
      sql: 'UPDATE Category SET sortOrder = ? WHERE slug = ?',
      args: [DOPLNKY_SORT_ORDER, "doplnky"],
    });
  }
  return id;
}

interface ProductRow {
  id: string;
  name: string;
  catSlug: string;
  catName: string;
}

async function loadProductsByFragments(
  client: Client,
  fragments: string[],
): Promise<ProductRow[]> {
  if (fragments.length === 0) return [];
  const placeholders = fragments.map(() => "p.name LIKE ?").join(" OR ");
  const args = fragments.map((f) => `%${f}%`);
  const res = await client.execute({
    sql:
      "SELECT p.id AS id, p.name AS name, c.slug AS catSlug, c.name AS catName " +
      "FROM Product p JOIN Category c ON p.categoryId = c.id WHERE " +
      placeholders,
    args,
  });
  return res.rows.map((r) => {
    const row = r as unknown as ProductRow;
    return { id: String(row.id), name: String(row.name), catSlug: String(row.catSlug), catName: String(row.catName) };
  });
}

async function reassign(
  client: Client,
  products: ProductRow[],
  targetCategoryId: string,
  targetSlug: string,
  write: boolean,
  label: string,
): Promise<number> {
  let moved = 0;
  for (const p of products) {
    if (p.catSlug === targetSlug) {
      console.log(`  [${label}] skip ${p.name} (already in ${targetSlug})`);
      continue;
    }
    console.log(
      `  [${label}] ${write ? "MOVE" : "DRY"} ${p.name}  [${p.catSlug} → ${targetSlug}]`,
    );
    if (write) {
      await client.execute({
        sql: 'UPDATE Product SET categoryId = ?, updatedAt = ? WHERE id = ?',
        args: [targetCategoryId, new Date().toISOString(), p.id],
      });
    }
    moved += 1;
  }
  return moved;
}

async function run(label: string, client: Client, write: boolean): Promise<void> {
  console.log(`\n=== ${label} (${write ? "WRITE" : "DRY-RUN"}) ===`);

  const botyId = await ensureBotyCategory(client, write, label);
  const doplnkyId = await getCategoryId(client, "doplnky");
  if (!doplnkyId) {
    throw new Error(`[${label}] "doplnky" category missing — refuse to migrate`);
  }

  const shoes = await loadProductsByFragments(client, SHOE_NAME_FRAGMENTS);
  console.log(`  [${label}] matched ${shoes.length} shoe products`);
  const scarves = await loadProductsByFragments(client, SCARF_NAME_FRAGMENTS);
  console.log(`  [${label}] matched ${scarves.length} scarf products`);

  const movedToBoty = await reassign(client, shoes, botyId, BOTY_SLUG, write, label);
  const movedToDoplnky = await reassign(client, scarves, doplnkyId, "doplnky", write, label);

  console.log(
    `  [${label}] summary: moved ${movedToBoty} → Boty, moved ${movedToDoplnky} → Doplňky`,
  );

  // Post-state audit
  const stateRes = await client.execute(
    "SELECT c.name, COUNT(*) AS n FROM Product p JOIN Category c ON p.categoryId = c.id GROUP BY c.name ORDER BY c.sortOrder",
  );
  console.log(`  [${label}] category state:`);
  for (const row of stateRes.rows) {
    const r = row as unknown as { name: string; n: number };
    console.log(`    - ${r.name}: ${r.n}`);
  }
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const useTurso = process.argv.includes("--turso");

  if (useTurso) {
    loadEnvLocal();
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;
    if (!url || !token) {
      throw new Error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN");
    }
    const client = createClient({ url: url.trim(), authToken: token.trim() });
    try {
      await run("turso", client, write);
    } finally {
      client.close();
    }
  } else {
    const dbPath = resolve(process.cwd(), "prisma/dev.db");
    const client = createClient({ url: `file:${dbPath}` });
    try {
      await run("dev.db", client, write);
    } finally {
      client.close();
    }
  }
}

main().catch((err) => {
  console.error("✗ categories-add-boty failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
