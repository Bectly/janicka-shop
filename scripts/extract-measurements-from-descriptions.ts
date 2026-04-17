/**
 * Extract structured measurements (chest/waist/hips/length in cm) from original
 * Vinted descriptions into Product.measurements JSON.
 *
 * Vinted sellers typically disclose flat measurements in Czech under a
 * "📏 Rozměry:" block, e.g.:
 *
 *   📏 Rozměry:
 *   šířka přes prsa cca 36 cm (pružné)
 *   délka cca 127 cm
 *   pas cca 34 cm
 *   boky: 35 cm
 *
 * These values are lost during the cleanup passes. This script scans
 * `Product.originalDescription`, extracts the first cm value for each of
 * chest / waist / hips / length, and writes the result to `Product.measurements`.
 *
 * Skips products where `measurements` is already populated (non-empty JSON).
 *
 * Usage:
 *   npx tsx scripts/extract-measurements-from-descriptions.ts            # dry-run
 *   npx tsx scripts/extract-measurements-from-descriptions.ts --apply    # write
 *
 * Turso: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (see scripts/README.md).
 */

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

type Field = "chest" | "waist" | "hips" | "length";

interface FieldRule {
  field: Field;
  // Pattern matches a label (diacritics-normalized, lowercased) immediately
  // before a cm value. Use /u flag; first capturing group MUST be the number.
  patterns: RegExp[];
}

// Accept decimal comma or dot, integer or one-decimal. Allow "cca" and
// punctuation between label and value. Capture 1..3 digits, optional .,5.
const NUM = String.raw`(\d{2,3}(?:[.,]\d)?)`;
// Value suffix: optional space, "cm", optional trailing context.
const CM = String.raw`\s*(?:cm|centimetr\w*)\b`;

const RULES: FieldRule[] = [
  {
    // "šířka přes prsa ... 36 cm", "šířka prsa: 43 cm", "prsa 43 cm",
    // "hrudník 43 cm", "Šířka prsa: 43 cm". Exclude stand-alone "přes prsa"
    // without a label to avoid capturing unrelated numbers.
    field: "chest",
    patterns: [
      new RegExp(String.raw`\b(?:sirka\s+(?:pres\s+)?prsa|hrudnik|prsa)\b[^0-9\n]{0,30}${NUM}${CM}`, "u"),
    ],
  },
  {
    // "pas 34 cm", "šířka pas: 33 cm", "v pase 34 cm", "obvod pasu 34 cm"
    field: "waist",
    patterns: [
      new RegExp(String.raw`\b(?:sirka\s+pas|obvod\s+pas\w*|v\s+pas\w*|pas\w*)\b[^0-9\n]{0,30}${NUM}${CM}`, "u"),
    ],
  },
  {
    // "boky 35 cm", "šířka boky: 37 cm", "obvod boků 90 cm"
    field: "hips",
    patterns: [
      new RegExp(String.raw`\b(?:sirka\s+bok\w*|obvod\s+bok\w*|bok\w*)\b[^0-9\n]{0,30}${NUM}${CM}`, "u"),
    ],
  },
  {
    // "délka cca 127 cm", "délka: 54 cm", "délka od ramen 40 cm",
    // "celková délka 100 cm". Avoid "délka rukávu" (sleeve length).
    field: "length",
    patterns: [
      new RegExp(String.raw`\b(?:celkova\s+delka|delka\s+od\s+ramen|delka)\b(?![^0-9\n]{0,30}\brukav)[^0-9\n]{0,30}${NUM}${CM}`, "u"),
    ],
  },
];

// Plausible flat-measurement ranges in cm. Values outside are likely
// mis-labeled (e.g. size number, weight, sleeve length) and dropped.
const RANGES: Record<Field, { min: number; max: number }> = {
  chest: { min: 25, max: 130 },
  waist: { min: 25, max: 130 },
  hips: { min: 25, max: 140 },
  length: { min: 20, max: 200 },
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatch(s: string): string {
  return stripDiacritics(s).toLowerCase();
}

function parseNumber(raw: string): number | null {
  const v = Number(raw.replace(",", "."));
  if (!Number.isFinite(v)) return null;
  return v;
}

type Extracted = Partial<Record<Field, number>>;

function extractMeasurements(desc: string): Extracted {
  const norm = normalizeForMatch(desc);
  const out: Extracted = {};

  for (const rule of RULES) {
    for (const p of rule.patterns) {
      const m = p.exec(norm);
      if (!m) continue;
      const n = parseNumber(m[1]);
      if (n === null) continue;
      const { min, max } = RANGES[rule.field];
      if (n < min || n > max) continue;
      // Store as integer if whole; otherwise keep one decimal.
      out[rule.field] = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
      break;
    }
  }

  return out;
}

function hasAny(m: Extracted): boolean {
  return (
    m.chest !== undefined ||
    m.waist !== undefined ||
    m.hips !== undefined ||
    m.length !== undefined
  );
}

function parseExisting(raw: string | null | undefined): Extracted {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Extracted;
  } catch {
    // ignore malformed
  }
  return {};
}

async function main() {
  const isApply = process.argv.includes("--apply");
  const isDryRun = !isApply;

  console.log("=== Extract Measurements from Vinted Descriptions ===");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "APPLY"}`);

  const db = await createDb();
  try {
    const products = await db.product.findMany({
      select: {
        id: true,
        name: true,
        measurements: true,
        originalDescription: true,
      },
    });
    console.log(`DB:   ${products.length} products`);

    let scanned = 0;
    let skippedNoDesc = 0;
    let skippedHasMeasurements = 0;
    let matched = 0;
    let updates = 0;
    const fieldCounts: Record<Field, number> = {
      chest: 0,
      waist: 0,
      hips: 0,
      length: 0,
    };
    const samples: string[] = [];

    for (const p of products) {
      if (!p.originalDescription || !p.originalDescription.trim()) {
        skippedNoDesc++;
        continue;
      }
      const existing = parseExisting(p.measurements);
      if (hasAny(existing)) {
        skippedHasMeasurements++;
        continue;
      }
      scanned++;

      const extracted = extractMeasurements(p.originalDescription);
      if (!hasAny(extracted)) continue;
      matched++;

      for (const k of Object.keys(extracted) as Field[]) {
        if (extracted[k] !== undefined) fieldCounts[k]++;
      }

      const json = JSON.stringify(extracted);
      updates++;

      if (samples.length < 20) {
        const parts = (Object.keys(extracted) as Field[])
          .filter((k) => extracted[k] !== undefined)
          .map((k) => `${k}=${extracted[k]}`)
          .join("  ");
        samples.push(`\n  • ${p.name}\n    ${parts}`);
      }

      if (isApply) {
        await db.product.update({
          where: { id: p.id },
          data: { measurements: json },
        });
      }
    }

    console.log();
    console.log(`Scanned (has originalDescription, no existing measurements): ${scanned}`);
    console.log(`Skipped — no originalDescription:                            ${skippedNoDesc}`);
    console.log(`Skipped — measurements already set:                          ${skippedHasMeasurements}`);
    console.log(`Products with measurement matches:                           ${matched}`);
    console.log(`Products to update:                                          ${updates}`);
    console.log();
    console.log(`Field breakdown:`, fieldCounts);

    if (samples.length) {
      console.log(`\nFirst ${samples.length} matches (review before --apply):`);
      for (const s of samples) console.log(s);
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
