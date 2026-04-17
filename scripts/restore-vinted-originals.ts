/**
 * Restore original Vinted source data into Product rows.
 *
 * Cleanup passes 2..6 overwrote the original Vinted descriptions with
 * marketing copy. This script backfills the new source-of-truth columns:
 *   - vintedId                 (Vinted item ID)
 *   - originalDescription      (untouched original description)
 *   - originalVintedData       (full original record, JSON string)
 *
 * It also restores brand / colors / sizes when currently empty, and
 * overwrites `description` only when the current value looks like garbage
 * (length < 40 OR identical to name).
 *
 * Matching strategy (first hit wins):
 *   1. By vintedId if already set
 *   2. By exact title === product.name
 *   3. By slugified title === product.slug (fallback)
 *
 * Usage:
 *   npx tsx scripts/restore-vinted-originals.ts             # dry-run (default)
 *   npx tsx scripts/restore-vinted-originals.ts --apply     # write changes
 *
 * Turso: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (see scripts/README.md).
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

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

const PRODUCTS_FILE = path.join(__dirname, "vinted-data", "products.json");

interface VintedRecord {
  vintedId: string;
  url?: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  originalPrice?: number | null;
  brand?: string;
  size?: string;
  condition?: string;
  color?: string[];
  category?: string;
  material?: string;
  measurements?: string;
  photoUrls?: string[];
  [k: string]: unknown;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeTitle(title: string): string {
  // Same cleanup import-vinted-products.ts applies (strip edge emojis).
  const stripped = title
    .replace(/^\s*[\u{1F300}-\u{1FAFF}\u{2702}-\u{27B0}]+\s*/u, "")
    .replace(/\s*[\u{1F300}-\u{1FAFF}\u{2702}-\u{27B0}]+\s*$/u, "")
    .trim();
  return stripped || title;
}

function isGarbageDescription(desc: string | null | undefined, name: string): boolean {
  if (!desc) return true;
  const d = desc.trim();
  if (d.length < 40) return true;
  if (d === name.trim()) return true;
  return false;
}

async function main() {
  const isApply = process.argv.includes("--apply");
  const isDryRun = !isApply;

  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error(`Products file not found: ${PRODUCTS_FILE}`);
    process.exit(1);
  }

  const rawProducts = JSON.parse(
    fs.readFileSync(PRODUCTS_FILE, "utf-8")
  ) as VintedRecord[];

  console.log("=== Restore Vinted Originals ===");
  console.log(`Mode:   ${isDryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`Source: ${rawProducts.length} records in products.json`);

  const db = await createDb();

  try {
    const dbProducts = await db.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        brand: true,
        colors: true,
        sizes: true,
        vintedId: true,
        originalDescription: true,
        originalVintedData: true,
      },
    });
    console.log(`DB:     ${dbProducts.length} products`);

    // Build lookup indexes: by vintedId, by name, by slug
    const byVintedId = new Map<string, (typeof dbProducts)[number]>();
    const byName = new Map<string, (typeof dbProducts)[number]>();
    const bySlug = new Map<string, (typeof dbProducts)[number]>();
    for (const p of dbProducts) {
      if (p.vintedId) byVintedId.set(p.vintedId, p);
      byName.set(p.name, p);
      bySlug.set(p.slug, p);
    }

    let matched = 0;
    let unmatched = 0;
    let updates = 0;
    let fieldCounts = {
      vintedId: 0,
      originalDescription: 0,
      originalVintedData: 0,
      description: 0,
      brand: 0,
      colors: 0,
      sizes: 0,
    };
    const samples: string[] = [];
    const unmatchedTitles: string[] = [];

    for (const rec of rawProducts) {
      const cleanTitle = normalizeTitle(rec.title);

      // Match strategy
      let dbProduct = rec.vintedId ? byVintedId.get(rec.vintedId) : undefined;
      if (!dbProduct) dbProduct = byName.get(cleanTitle) || byName.get(rec.title);
      if (!dbProduct) dbProduct = bySlug.get(slugify(cleanTitle));
      if (!dbProduct) {
        unmatched++;
        unmatchedTitles.push(`[${rec.vintedId}] ${rec.title}`);
        continue;
      }
      matched++;

      // Build update payload
      const data: Record<string, unknown> = {};

      if (!dbProduct.vintedId && rec.vintedId) {
        data.vintedId = rec.vintedId;
        fieldCounts.vintedId++;
      }

      if (!dbProduct.originalDescription && rec.description) {
        data.originalDescription = rec.description;
        fieldCounts.originalDescription++;
      }

      if (!dbProduct.originalVintedData) {
        data.originalVintedData = JSON.stringify(rec);
        fieldCounts.originalVintedData++;
      }

      // Overwrite description only when current looks like garbage.
      if (
        rec.description &&
        isGarbageDescription(dbProduct.description, dbProduct.name)
      ) {
        data.description = rec.description;
        fieldCounts.description++;
      }

      // Restore brand if empty
      if ((!dbProduct.brand || dbProduct.brand === "") && rec.brand) {
        data.brand = rec.brand;
        fieldCounts.brand++;
      }

      // Restore colors if empty
      if (
        (dbProduct.colors === "[]" || !dbProduct.colors) &&
        Array.isArray(rec.color) &&
        rec.color.length > 0
      ) {
        data.colors = JSON.stringify(rec.color);
        fieldCounts.colors++;
      }

      // Restore sizes if empty
      if (
        (dbProduct.sizes === "[]" || !dbProduct.sizes) &&
        rec.size &&
        rec.size.trim()
      ) {
        const arr = rec.size
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean);
        if (arr.length > 0) {
          data.sizes = JSON.stringify(arr);
          fieldCounts.sizes++;
        }
      }

      if (Object.keys(data).length === 0) continue;
      updates++;

      if (samples.length < 5) {
        samples.push(
          `${dbProduct.name}  →  ${Object.keys(data).join(", ")}`
        );
      }

      if (isApply) {
        await db.product.update({
          where: { id: dbProduct.id },
          data,
        });
      }
    }

    console.log();
    console.log(`Matched:   ${matched}`);
    console.log(`Unmatched: ${unmatched}`);
    console.log(`Updates:   ${updates}`);
    console.log(`Field fills:`, fieldCounts);

    if (samples.length) {
      console.log(`\nSample diffs:`);
      for (const s of samples) console.log(`  ${s}`);
    }

    if (unmatchedTitles.length) {
      console.error(`\nUnmatched products (in products.json, no DB hit):`);
      for (const t of unmatchedTitles) console.error(`  - ${t}`);
    }

    console.log();
    if (isDryRun) {
      console.log("🔍 DRY RUN — no changes written. Re-run with --apply.");
    } else {
      console.log("✅ APPLY done.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
