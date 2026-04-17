/**
 * Normalize legacy free-text product sizes to the fixed enum in src/lib/sizes.ts.
 *
 * Usage:
 *   npx tsx scripts/normalize-sizes.ts --dry-run    # preview (default)
 *   npx tsx scripts/normalize-sizes.ts --apply      # write changes
 *
 * The script walks every product, reads its `sizes` JSON array, maps each entry
 * through `normalizeSizesForCategory(...)` (category-aware), and writes the
 * canonical array back. Empty / unknown sizes fall back to ["Univerzální"].
 *
 * Works against the dev SQLite DB by default. Set TURSO_DATABASE_URL +
 * TURSO_AUTH_TOKEN to run against production Turso (see scripts/README.md).
 */

import { PrismaClient } from "@prisma/client";
import { normalizeSizesForCategory } from "../src/lib/sizes";

async function createDb(): Promise<PrismaClient> {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (tursoUrl && tursoToken) {
    const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
    const adapter = new PrismaLibSQL({
      url: tursoUrl.trim(),
      authToken: tursoToken.trim(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PrismaClient({ adapter } as any);
  }
  return new PrismaClient();
}

function parseSizes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const dryRun = !apply;

  if (dryRun) {
    console.log("🔍 DRY RUN — no changes will be written. Use --apply to commit.");
  } else {
    console.log("✏️  APPLY mode — writing changes to DB.");
  }

  const db = await createDb();
  const products = await db.product.findMany({
    select: {
      id: true,
      sku: true,
      name: true,
      sizes: true,
      category: { select: { slug: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nFound ${products.length} products.\n`);

  type Row = {
    id: string;
    sku: string;
    name: string;
    category: string;
    before: string[];
    after: string[];
    dropped: string[];
  };

  const changes: Row[] = [];
  const unchanged: Row[] = [];
  const droppedAll: Set<string> = new Set();

  for (const p of products) {
    const before = parseSizes(p.sizes);
    const { sizes: after, dropped } = normalizeSizesForCategory(
      before,
      p.category?.slug ?? null,
    );
    for (const d of dropped) droppedAll.add(`${p.category?.slug ?? "?"}:${d}`);
    const row: Row = {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category?.slug ?? "?",
      before,
      after,
      dropped,
    };
    if (arraysEqual(before, after)) unchanged.push(row);
    else changes.push(row);
  }

  console.log(`Unchanged: ${unchanged.length}`);
  console.log(`Will change: ${changes.length}\n`);

  if (changes.length > 0) {
    console.log("── Diffs ───────────────────────────────────────────────");
    for (const c of changes.slice(0, 50)) {
      console.log(
        `  [${c.category}] ${c.sku.padEnd(12)} ${JSON.stringify(c.before).padEnd(30)} → ${JSON.stringify(c.after)}${c.dropped.length ? `  (dropped: ${c.dropped.join(", ")})` : ""}`,
      );
    }
    if (changes.length > 50) {
      console.log(`  … and ${changes.length - 50} more`);
    }
  }

  if (droppedAll.size > 0) {
    console.log("\n── Unknown values encountered (mapped to Univerzální) ──");
    for (const d of [...droppedAll].sort()) console.log(`  ${d}`);
  }

  if (apply && changes.length > 0) {
    console.log("\nApplying changes…");
    let written = 0;
    for (const c of changes) {
      await db.product.update({
        where: { id: c.id },
        data: { sizes: JSON.stringify(c.after) },
      });
      written++;
      if (written % 50 === 0) console.log(`  …${written} updated`);
    }
    console.log(`\n✅ Updated ${written} products.`);
  } else if (dryRun) {
    console.log("\nDry run complete — no changes written. Re-run with --apply to commit.");
  } else {
    console.log("\nNothing to apply.");
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
