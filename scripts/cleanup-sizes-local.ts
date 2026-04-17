/**
 * Local-DB variant of cleanup-sizes.ts — targets prisma/dev.db via libsql file URL.
 *
 *   npx tsx scripts/cleanup-sizes-local.ts          # dry-run
 *   npx tsx scripts/cleanup-sizes-local.ts --write  # apply to local dev.db
 */
import { createClient } from "@libsql/client";
import path from "node:path";
import { getSizesForCategory, normalizeSize } from "../src/lib/sizes";

function filterValidForCategory(
  raw: string[],
  categorySlug: string | null | undefined,
): { sizes: string[]; dropped: string[] } {
  const allowed = new Set(getSizesForCategory(categorySlug));
  const valid: string[] = [];
  const dropped: string[] = [];
  for (const entry of raw) {
    const norm = normalizeSize(entry);
    if (norm && allowed.has(norm)) {
      if (!valid.includes(norm)) valid.push(norm);
    } else {
      dropped.push(entry);
    }
  }
  return { sizes: valid.length > 0 ? valid : ["Univerzální"], dropped };
}

async function main() {
  const WRITE = process.argv.includes("--write");
  const dbPath = path.resolve(process.cwd(), "prisma/dev.db");
  const client = createClient({ url: `file:${dbPath}` });

  const res = await client.execute(
    "SELECT p.id, p.name, p.sizes, c.slug AS categorySlug FROM Product p JOIN Category c ON p.categoryId = c.id",
  );

  let changed = 0;
  let unchanged = 0;
  const byCat = new Map<string, number>();
  const samples: Array<{ cat: string; name: string; before: string; after: string; dropped: string[] }> = [];

  for (const row of res.rows as unknown as Array<{ id: string; name: string; sizes: string; categorySlug: string }>) {
    let parsed: string[];
    try {
      const j = JSON.parse(row.sizes || "[]");
      parsed = Array.isArray(j) ? j : [];
    } catch {
      parsed = [];
    }

    const { sizes: normalized, dropped } = filterValidForCategory(parsed, row.categorySlug);
    const before = JSON.stringify(parsed);
    const after = JSON.stringify(normalized);

    if (before === after) {
      unchanged++;
      continue;
    }

    changed++;
    byCat.set(row.categorySlug, (byCat.get(row.categorySlug) ?? 0) + 1);
    if (samples.length < 30) {
      samples.push({ cat: row.categorySlug, name: row.name, before, after, dropped });
    }

    if (WRITE) {
      await client.execute({
        sql: "UPDATE Product SET sizes = ? WHERE id = ?",
        args: [after, row.id],
      });
    }
  }

  console.log(`\n${WRITE ? "APPLIED (local dev.db)" : "DRY-RUN (local dev.db)"}`);
  console.log(`Changed: ${changed}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log("\nBy category:");
  for (const [cat, n] of byCat) console.log(`  ${cat}: ${n}`);
  console.log("\nSamples:");
  for (const s of samples) {
    console.log(`  [${s.cat}] ${(s.name || "").slice(0, 40)}`);
    console.log(`    ${s.before}  →  ${s.after}${s.dropped.length ? `  (dropped: ${JSON.stringify(s.dropped)})` : ""}`);
  }

  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
