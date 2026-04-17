/**
 * Cleanup Product.sizes — normalize mixed/garbage size arrays to canonical
 * category-appropriate values. Uses the same logic as the admin size enum.
 *
 *   npx tsx scripts/cleanup-sizes.ts          # dry-run
 *   npx tsx scripts/cleanup-sizes.ts --write  # apply to Turso
 */
import { createClient } from "@libsql/client";
import { getSizesForCategory, normalizeSize } from "../src/lib/sizes";

/**
 * Keep every size in `raw` that normalizes to a canonical value allowed for
 * the category; drop the rest. Does NOT collapse to a primary — a product
 * tagged ["M","38"] keeps both so the letter and EU filters both match.
 */
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
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const res = await client.execute(
    "SELECT p.id, p.name, p.sizes, c.slug AS categorySlug FROM Product p JOIN Category c ON p.categoryId = c.id",
  );

  let changed = 0;
  let unchanged = 0;
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

  console.log(`\n${WRITE ? "APPLIED" : "DRY-RUN"}`);
  console.log(`Changed: ${changed}`);
  console.log(`Unchanged: ${unchanged}`);
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
