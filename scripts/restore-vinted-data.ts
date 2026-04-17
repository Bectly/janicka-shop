/**
 * Re-import original Vinted source data + extract defects.
 *
 * Combines two steps into one pass:
 *   1. Restore originals: vintedId, originalDescription, originalVintedData
 *      (also fills description if current looks like garbage; brand/colors/sizes if empty)
 *   2. Extract defects from original description → defectsNote (Czech keywords)
 *
 * Matching strategy (first hit wins):
 *   1. By vintedId if already set on Product
 *   2. By exact title === product.name (after edge-emoji strip)
 *   3. By slugified title === product.slug (fallback)
 *
 * Preserves prior admin edits: defectsNote is only written when currently empty.
 *
 * Usage:
 *   npx tsx scripts/restore-vinted-data.ts               # apply (default)
 *   npx tsx scripts/restore-vinted-data.ts --dry-run     # preview only
 *
 * Turso: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (see scripts/README.md).
 * Otherwise runs against local prisma/dev.db via DATABASE_URL.
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

// ---------- Matching helpers ----------

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

// ---------- Defect extraction ----------

type DefectType =
  | "stain"
  | "pilling"
  | "scuff"
  | "faded"
  | "small_hole"
  | "missing_button"
  | "damaged_zipper"
  | "loose_seam"
  | "yellowing"
  | "other";

interface KeywordRule {
  type: DefectType;
  patterns: RegExp[];
}

const stem = (s: string) => new RegExp(`\\b${s}\\w*`, "u");

const RULES: KeywordRule[] = [
  { type: "stain", patterns: [stem("skvrn"), stem("flec"), stem("flic"), stem("spinav")] },
  { type: "pilling", patterns: [stem("zmolk"), stem("zmolek")] },
  { type: "scuff", patterns: [stem("odren"), stem("oderk"), stem("oderek"), stem("oderen")] },
  { type: "faded", patterns: [stem("vybled")] },
  {
    type: "small_hole",
    patterns: [
      /\bdrobna dir\w*/u,
      /\bmala dir\w*/u,
      stem("trhlink"),
      stem("praslin"),
      stem("prasklin"),
      stem("natrz"),
      stem("roztrh"),
      /\bdir[ka]\w*/u,
    ],
  },
  {
    type: "missing_button",
    patterns: [/\bchybejici knoflik\w*/u, /\bchybi knoflik\w*/u],
  },
  {
    type: "damaged_zipper",
    patterns: [
      /\bposkozeny zip\w*/u,
      /\bvadny zip\w*/u,
      /\bnejde zip\w*/u,
      /\brozbity zip\w*/u,
      /\buvolneny zip\w*/u,
    ],
  },
  {
    type: "loose_seam",
    patterns: [/\buvolneny sev\w*/u, /\bpovoleny sev\w*/u, stem("rozparan")],
  },
  { type: "yellowing", patterns: [stem("zazloutl"), stem("zazloutnut"), stem("zezloutl")] },
  {
    type: "other",
    patterns: [
      stem("opotreben"),
      /\bdrobna vada\w*/u,
      /\bdrobne vady\w*/u,
      stem("nedokonalost"),
      stem("poskoz"),
      /\bs vadou\b/u,
    ],
  },
];

const NEGATION = /\b(?:bez|zadn\w*|neni\w*|nema\w*|nemaji\w*|nijak\w*|ne)\b/u;
const FALSE_POSITIVE_CONTEXT =
  /\b(knoflikov|knoflik|perforac|prolamov|sitovin|krajk|derov|dekorativ|ozdob)\w*/u;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatch(s: string): string {
  return stripDiacritics(s).toLowerCase();
}

function splitSentences(text: string): string[] {
  return text
    .split(/[\n\r]+|(?<=[.!?])\s+/u)
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length < 400);
}

interface Match {
  type: DefectType;
  sentence: string;
}

function extractDefectSentences(desc: string): Match[] {
  const sentences = splitSentences(desc);
  const hits: Match[] = [];
  const seen = new Set<string>();

  for (const raw of sentences) {
    const norm = normalizeForMatch(raw);

    if (/^#/.test(raw.trim())) continue;
    if (/^(\s*[•📏📐]|velikost|rozměr|šířka|délka|materiál)/iu.test(raw)) continue;

    for (const rule of RULES) {
      let earliest = -1;
      for (const p of rule.patterns) {
        const m = p.exec(norm);
        if (m && (earliest < 0 || m.index < earliest)) earliest = m.index;
      }
      if (earliest < 0) continue;

      const prefix = norm.slice(0, earliest);
      if (NEGATION.test(prefix)) continue;

      if (rule.type === "small_hole" && FALSE_POSITIVE_CONTEXT.test(norm)) continue;

      const sentence = raw.length > 300 ? raw.slice(0, 297) + "..." : raw;
      const key = `${rule.type}::${sentence}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ type: rule.type, sentence });
    }
  }

  return hits;
}

function cleanDefectSentence(s: string): string {
  // Strip trailing emoji-only tails, trim punctuation on edges, collapse whitespace.
  let out = s.replace(/\s+/g, " ").trim();
  // Drop leading list bullets and dashes.
  out = out.replace(/^[-–—•*]\s*/u, "");
  // Capitalize first letter if it is lowercase Czech.
  if (out.length > 0) out = out.charAt(0).toUpperCase() + out.slice(1);
  // Ensure single trailing period if sentence-like and missing punctuation.
  if (out.length > 0 && !/[.!?…]$/.test(out)) out += ".";
  return out;
}

function formatDefectsNote(matches: Match[]): string {
  const seenSentences = new Set<string>();
  const lines: string[] = [];
  for (const m of matches) {
    const cleaned = cleanDefectSentence(m.sentence);
    if (seenSentences.has(cleaned)) continue;
    seenSentences.add(cleaned);
    lines.push(cleaned);
  }
  return lines.join(" ").trim();
}

// ---------- Main ----------

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isApply = !isDryRun;

  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error(`Products file not found: ${PRODUCTS_FILE}`);
    process.exit(1);
  }

  const rawProducts = JSON.parse(
    fs.readFileSync(PRODUCTS_FILE, "utf-8"),
  ) as VintedRecord[];

  console.log("=== Restore Vinted Data (originals + defects) ===");
  console.log(`Mode:   ${isApply ? "APPLY" : "DRY RUN"}`);
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
        defectsNote: true,
      },
    });
    console.log(`DB:     ${dbProducts.length} products`);

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
    let defectsExtracted = 0;
    const fieldCounts = {
      vintedId: 0,
      originalDescription: 0,
      originalVintedData: 0,
      description: 0,
      brand: 0,
      colors: 0,
      sizes: 0,
      defectsNote: 0,
    };
    const defectSamples: string[] = [];
    const unmatchedTitles: string[] = [];

    for (const rec of rawProducts) {
      const cleanTitle = normalizeTitle(rec.title);

      let dbProduct = rec.vintedId ? byVintedId.get(rec.vintedId) : undefined;
      if (!dbProduct) dbProduct = byName.get(cleanTitle) || byName.get(rec.title);
      if (!dbProduct) dbProduct = bySlug.get(slugify(cleanTitle));
      if (!dbProduct) {
        unmatched++;
        unmatchedTitles.push(`[${rec.vintedId}] ${rec.title}`);
        continue;
      }
      matched++;

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

      if (
        rec.description &&
        isGarbageDescription(dbProduct.description, dbProduct.name)
      ) {
        data.description = rec.description;
        fieldCounts.description++;
      }

      if ((!dbProduct.brand || dbProduct.brand === "") && rec.brand) {
        data.brand = rec.brand;
        fieldCounts.brand++;
      }

      if (
        (dbProduct.colors === "[]" || !dbProduct.colors) &&
        Array.isArray(rec.color) &&
        rec.color.length > 0
      ) {
        data.colors = JSON.stringify(rec.color);
        fieldCounts.colors++;
      }

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

      // Defect extraction — only fill when empty (preserve admin edits).
      const descForDefects =
        rec.description ?? dbProduct.originalDescription ?? null;
      if (
        (!dbProduct.defectsNote || !dbProduct.defectsNote.trim()) &&
        descForDefects
      ) {
        const hits = extractDefectSentences(descForDefects);
        if (hits.length > 0) {
          const note = formatDefectsNote(hits);
          if (note) {
            data.defectsNote = note;
            fieldCounts.defectsNote++;
            defectsExtracted++;
            if (defectSamples.length < 10) {
              defectSamples.push(
                `  • ${dbProduct.name}\n    → ${note.slice(0, 220)}${note.length > 220 ? "..." : ""}`,
              );
            }
          }
        }
      }

      if (Object.keys(data).length === 0) continue;
      updates++;

      if (isApply) {
        await db.product.update({
          where: { id: dbProduct.id },
          data,
        });
      }
    }

    console.log();
    console.log(`Matched:            ${matched}`);
    console.log(`Unmatched:          ${unmatched}`);
    console.log(`Products updated:   ${updates}`);
    console.log(`Defects extracted:  ${defectsExtracted}`);
    console.log(`Field fills:       `, fieldCounts);

    if (defectSamples.length) {
      console.log(`\nSample defect notes:`);
      for (const s of defectSamples) console.log(s);
    }

    if (unmatchedTitles.length) {
      console.error(`\nUnmatched products (no DB hit):`);
      for (const t of unmatchedTitles) console.error(`  - ${t}`);
    }

    console.log();
    if (isApply) {
      console.log("APPLY done.");
    } else {
      console.log("DRY RUN — no changes written. Re-run without --dry-run to apply.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
