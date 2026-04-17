/**
 * Extract defect mentions from original Vinted descriptions into Product.defectsNote.
 *
 * Many original Vinted descriptions disclose minor flaws (stains, pilling,
 * scuffs, small tears, missing buttons) that were lost during the cleanup
 * passes. This script scans `Product.originalDescription` for Czech defect
 * keywords, extracts the sentence(s) mentioning them, and writes a concise
 * note to `Product.defectsNote`.
 *
 * Current schema uses free-text `defectsNote` + `defectImages` (JSON URLs)
 * — see src/lib/defects.ts. Enum-based DefectType no longer exists.
 *
 * Skips products where `defectsNote` is already set (admin edits preserved).
 *
 * Usage:
 *   npx tsx scripts/extract-defects-from-descriptions.ts             # dry-run (default)
 *   npx tsx scripts/extract-defects-from-descriptions.ts --apply     # write changes
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
  // Word-boundary patterns matched against diacritics-normalized, lowercased text.
  // Patterns must match whole words (or phrases) to avoid substring collisions
  // like "knoflíček" → "flíček" (button → stain).
  patterns: RegExp[];
}

// Build a stem regex with word boundaries — matches the stem followed by any
// Czech inflection (a/y/u/ou/ě/ou/ami/...).
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
      /\bdir[ka]\w*/u, // díra, dírka — watch for FP guard below
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
      /\bs vadou\b/u,
    ],
  },
];

const SEVERITY_MODERATE = /\b(vyrazn|silny|silna|silne|vetsi|znacn)\w*/u;
const SEVERITY_MINOR = /\b(drobn|maly|mala|male|lehk|nepatrn|mirn)\w*/u;

// Negation markers — if present BEFORE a keyword in the same sentence,
// the keyword is a disclaimer ("bez žmolků", "není to skvrna"), not a defect.
const NEGATION = /\b(bez|zadn|neni|nema|nemaji|nijak)\w*/u;

// Words that indicate a construction/design detail, NOT a defect, and should
// suppress matches like "dira"/"dirka" (could be buttonhole, perforation, etc).
const FALSE_POSITIVE_CONTEXT = /\b(knoflikov|knoflik|perforac|prolamov|sitovin|krajk|derov|dekorativ|ozdob)\w*/u;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatch(s: string): string {
  return stripDiacritics(s).toLowerCase();
}

function splitSentences(text: string): string[] {
  // Split on newlines AND sentence terminators. Keep trimmed non-empty chunks.
  return text
    .split(/[\n\r]+|(?<=[.!?])\s+/u)
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length < 400); // Skip huge unbroken blocks (hashtags etc.)
}

type Match = { type: DefectType; sentence: string; severity: "minor" | "moderate" };

function extractMatches(desc: string): Match[] {
  const sentences = splitSentences(desc);
  const hits: Match[] = [];
  const seen = new Set<string>(); // Dedupe by type+sentence

  for (const raw of sentences) {
    const norm = normalizeForMatch(raw);

    // Skip hashtag-only lines (tags like #nike #zip are listing tags)
    if (/^#/.test(raw.trim())) continue;
    // Skip size/measurement lines
    if (/^(\s*[•📏📐]|velikost|rozměr|šířka|délka|materiál)/iu.test(raw)) continue;

    for (const rule of RULES) {
      let earliest = -1;
      for (const p of rule.patterns) {
        const m = p.exec(norm);
        if (m && (earliest < 0 || m.index < earliest)) earliest = m.index;
      }
      if (earliest < 0) continue;

      // Negation guard — if "bez/žádné/není/nemá" appears before the keyword
      // in the same sentence, it's a disclaimer, not a defect disclosure.
      const prefix = norm.slice(0, earliest);
      if (NEGATION.test(prefix)) continue;

      // False-positive guard for "dira"/"dirka" — could be buttonhole / perforation.
      if (rule.type === "small_hole" && FALSE_POSITIVE_CONTEXT.test(norm)) continue;

      const severity: "minor" | "moderate" = SEVERITY_MODERATE.test(norm)
        ? "moderate"
        : SEVERITY_MINOR.test(norm)
          ? "minor"
          : "minor";

      const sentence = raw.length > 300 ? raw.slice(0, 297) + "..." : raw;
      const key = `${rule.type}::${sentence}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ type: rule.type, sentence, severity });
    }
  }

  return hits;
}

function formatDefectsNote(matches: Match[]): string {
  // Join matched sentences into a single Czech-readable note. Drop duplicate
  // sentences that fired multiple rules; keep the order they appeared.
  const seenSentences = new Set<string>();
  const lines: string[] = [];
  for (const m of matches) {
    if (seenSentences.has(m.sentence)) continue;
    seenSentences.add(m.sentence);
    lines.push(m.sentence);
  }
  return lines.join(" ").trim();
}

async function main() {
  const isApply = process.argv.includes("--apply");
  const isDryRun = !isApply;

  console.log("=== Extract Defects from Vinted Descriptions ===");
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "APPLY"}`);

  const db = await createDb();
  try {
    const products = await db.product.findMany({
      select: {
        id: true,
        name: true,
        defectsNote: true,
        originalDescription: true,
      },
    });
    console.log(`DB:   ${products.length} products`);

    let scanned = 0;
    let skippedNoDesc = 0;
    let skippedHasNote = 0;
    let matched = 0;
    let updates = 0;
    const typeCounts: Record<DefectType, number> = {
      stain: 0,
      pilling: 0,
      scuff: 0,
      faded: 0,
      small_hole: 0,
      missing_button: 0,
      damaged_zipper: 0,
      loose_seam: 0,
      yellowing: 0,
      other: 0,
    };
    const severityCounts = { minor: 0, moderate: 0 };
    const samples: string[] = [];

    for (const p of products) {
      if (!p.originalDescription || !p.originalDescription.trim()) {
        skippedNoDesc++;
        continue;
      }
      if (p.defectsNote && p.defectsNote.trim()) {
        skippedHasNote++;
        continue;
      }
      scanned++;

      const hits = extractMatches(p.originalDescription);
      if (hits.length === 0) continue;
      matched++;

      for (const h of hits) {
        typeCounts[h.type]++;
        severityCounts[h.severity]++;
      }

      const note = formatDefectsNote(hits);
      if (!note) continue;
      updates++;

      if (samples.length < 20) {
        const types = Array.from(new Set(hits.map((h) => h.type))).join(",");
        const severities = Array.from(new Set(hits.map((h) => h.severity))).join(",");
        samples.push(
          `\n  • ${p.name}\n    types: [${types}]  severity: [${severities}]\n    note:  ${note.slice(0, 220)}${note.length > 220 ? "..." : ""}`,
        );
      }

      if (isApply) {
        await db.product.update({
          where: { id: p.id },
          data: { defectsNote: note },
        });
      }
    }

    console.log();
    console.log(`Scanned (has originalDescription, no existing note): ${scanned}`);
    console.log(`Skipped — no originalDescription:                    ${skippedNoDesc}`);
    console.log(`Skipped — defectsNote already set (admin edit):      ${skippedHasNote}`);
    console.log(`Products with defect matches:                        ${matched}`);
    console.log(`Products to update:                                  ${updates}`);
    console.log();
    console.log(`Type breakdown:`, typeCounts);
    console.log(`Severity:     `, severityCounts);

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
