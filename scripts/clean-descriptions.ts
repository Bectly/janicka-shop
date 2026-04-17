/**
 * Clean up product descriptions imported from Vinted.
 *
 * The raw Vinted text contains a lot of junk that does NOT belong in an eshop:
 *   - Self-promo ("Mrkni i na profil", "Nabízím i další kousky")
 *   - Vinted-specific offers ("Sleva na sety 25 %", "Při nákupu více kusů")
 *   - Hashtags (#vintedcz #secondhand ...)
 *   - Decoration emojis used as bullets (🛍️ 👀 🔥 ❤️ ...)
 *   - Trailing "... více" truncation marker
 *   - Excessive blank lines
 *
 * Kept: material, color, style notes, measurements, condition, size, brand,
 *       care instructions, everything describing the actual product.
 *
 * Source of truth for the raw text is `originalDescription` (populated by
 * restore-vinted-data.ts). We clean it and write the result into `description`.
 * `originalDescription` is preserved as backup and never touched.
 *
 * Usage:
 *   npx tsx scripts/clean-descriptions.ts               # apply (default)
 *   npx tsx scripts/clean-descriptions.ts --dry-run     # preview only
 *
 * Turso: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (see scripts/README.md).
 * Otherwise runs against local prisma/dev.db via DATABASE_URL.
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

// ---------- Cleaning helpers ----------

// Strip emoji and pictographic symbols. Keep plain text / diacritics / punctuation.
// Covers: emoticons, misc symbols & pictographs, transport, supplemental,
// dingbats, regional indicators, variation selectors, zero-width joiner.
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]/gu;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Line-level filters — if a line matches, it's pure Vinted-platform noise.
function isJunkLine(line: string): boolean {
  const raw = line.trim();
  if (!raw) return false; // don't drop blank lines here, handled later
  const n = stripDiacritics(raw).toLowerCase();

  // Self-promo: "mrkni / koukni / podivej" + "profil / me / kousky / dalsi"
  if (
    /\b(mrkni|koukni|podivej|podivejte|pridavam)\b/.test(n) &&
    /\b(profil|u me|kousk|dalsi|balic|vec)/.test(n)
  )
    return true;

  // "Nabízím i další..." / "přidám do balíčku"
  if (/\bnabizim\b.*\bdalsi\b/.test(n)) return true;
  if (/\brada (spoj|prida|udela|posl)/.test(n)) return true;
  if (/\b(spojim|prihodim|pridam)\b.*\bbalic/.test(n)) return true;

  // Sleva / Vinted-specific offers
  if (/\bsleva\b/.test(n) && /\b(set|nakup|kup|kusu|vec|profil|vice)/.test(n))
    return true;
  if (/\bmnozstevn/.test(n) && /\bsleva/.test(n)) return true;
  if (/\bsleva mozna\b/.test(n)) return true;
  if (/\bpri (nakupu|koupi) vice\b/.test(n)) return true;
  if (/\bprodejobleceni\b|\bvintedcz\b/.test(n)) return true;

  // Hashtag-dominated line: line is mostly hashtags (typical Vinted tag wall)
  const hashCount = (raw.match(/#[^\s#]+/g) || []).length;
  if (hashCount >= 2) return true;
  // Single-hashtag line with little else
  if (hashCount === 1 && raw.replace(/#[^\s#]+/g, "").trim().length < 3)
    return true;

  // Bare "... více" truncation marker left over from the scrape
  if (/^\.{2,}\s*vice\s*$/.test(n)) return true;

  return false;
}

function cleanLine(line: string): string {
  let out = line;

  // Remove trailing "... více" (scrape truncation marker)
  out = out.replace(/\s*\.{2,}\s*v[ií]ce\s*$/iu, "");

  // Remove inline hashtags (e.g. "... krásné #saty #elegantni")
  out = out.replace(/#[^\s#]+/g, "");

  // Remove stray "vintedcz" / "vinted" tokens outside hashtags
  out = out.replace(/\bvintedcz\b/giu, "");
  out = out.replace(/\bvinted\b/giu, "");

  // Strip emojis
  out = out.replace(EMOJI_RE, "");

  // Collapse whitespace, drop leftover bullet-only lines
  out = out.replace(/[ \t]+/g, " ").trim();

  // Normalize leading bullets: "•", "–", "—", "*", "✔️", "➡️" → "• "
  // (emojis already stripped; these are the remaining text bullets)
  out = out.replace(/^[•·\-–—*]\s*/u, "• ");

  // Line that became empty or just punctuation after stripping
  if (/^[\s\-–—•·*.,:;!?]*$/.test(out)) return "";

  return out;
}

function cleanDescription(raw: string): string {
  // Split into lines, also splitting on the "... více" marker which often
  // sits mid-text before a hashtag tail.
  const lines = raw.split(/\r?\n/);

  const kept: string[] = [];
  for (const line of lines) {
    if (isJunkLine(line)) continue;
    const cleaned = cleanLine(line);
    kept.push(cleaned); // may be empty string — used for paragraph spacing
  }

  // Collapse runs of empty lines to a single blank line; trim edges.
  const out: string[] = [];
  let lastEmpty = false;
  for (const l of kept) {
    const empty = l === "";
    if (empty && (out.length === 0 || lastEmpty)) continue;
    out.push(l);
    lastEmpty = empty;
  }
  while (out.length && out[out.length - 1] === "") out.pop();

  return out.join("\n").trim();
}

// ---------- Main ----------

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const isApply = !isDryRun;

  console.log("=== Clean Product Descriptions ===");
  console.log(`Mode: ${isApply ? "APPLY" : "DRY RUN"}`);

  const db = await createDb();

  try {
    const products = await db.product.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        originalDescription: true,
      },
    });
    console.log(`DB: ${products.length} products`);

    let considered = 0;
    let updated = 0;
    let skippedNoSource = 0;
    let skippedUnchanged = 0;
    const samples: string[] = [];

    for (const p of products) {
      const source = p.originalDescription ?? p.description ?? "";
      if (!source.trim()) {
        skippedNoSource++;
        continue;
      }
      considered++;

      const cleaned = cleanDescription(source);

      if (!cleaned.trim()) {
        // If cleaning nuked everything, leave the current description alone —
        // something was there, we just don't know what to keep.
        skippedUnchanged++;
        continue;
      }

      if (cleaned === (p.description ?? "").trim()) {
        skippedUnchanged++;
        continue;
      }

      if (samples.length < 5) {
        samples.push(
          [
            `--- ${p.name} ---`,
            `BEFORE:`,
            source.slice(0, 400) + (source.length > 400 ? "..." : ""),
            `AFTER:`,
            cleaned.slice(0, 400) + (cleaned.length > 400 ? "..." : ""),
          ].join("\n"),
        );
      }

      updated++;
      if (isApply) {
        await db.product.update({
          where: { id: p.id },
          data: { description: cleaned },
        });
      }
    }

    console.log();
    console.log(`Considered:         ${considered}`);
    console.log(`Updated:            ${updated}`);
    console.log(`Skipped (no src):   ${skippedNoSource}`);
    console.log(`Skipped (nochange): ${skippedUnchanged}`);

    if (samples.length) {
      console.log();
      console.log("Samples:");
      for (const s of samples) {
        console.log(s);
        console.log();
      }
    }

    if (!isApply) {
      console.log("DRY RUN — no changes written. Re-run without --dry-run to apply.");
    } else {
      console.log("APPLY done.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
