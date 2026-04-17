/**
 * Move "Upozornění na vadu:" lines from Product.description → Product.defectsNote.
 *
 * Some products were imported with an explicit "Upozornění na vadu: ..."
 * block in the description. The badge on PDP (ProductDefects) reads
 * `defectsNote` only and falls back to "Bez viditelných vad" when empty —
 * so these products show a misleading "no defects" badge despite disclosing
 * a defect in the description text. This script extracts the warning text,
 * writes it to `defectsNote`, and strips the matched block from `description`.
 *
 * Usage (dry-run default, write with --apply):
 *   npx tsx scripts/move-defect-warnings-from-description.ts
 *   npx tsx scripts/move-defect-warnings-from-description.ts --apply
 *
 * Turso: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
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

const WARNING_RE =
  /(^|\n)\s*(?:⚠️\s*)?Upozorn[ěe]n[ií][^:\n]*(?:na\s+vad[uěy]|vad[uěy])[^:\n]*:\s*([\s\S]*?)(?=\n\s*\n|\n\s*(?:[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][^\n]*:)|$)/gi;

interface Extraction {
  note: string;
  cleanedDescription: string;
}

function extractWarnings(description: string): Extraction | null {
  const matches: string[] = [];
  let cleaned = description;

  cleaned = cleaned.replace(WARNING_RE, (_full, _lead, body: string) => {
    const trimmed = body.trim();
    if (trimmed) matches.push(trimmed);
    return "\n";
  });

  if (matches.length === 0) return null;

  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  const note = matches.join("\n").trim();
  return { note, cleanedDescription: cleaned };
}

async function main() {
  const isApply = process.argv.includes("--apply");
  console.log("=== Move 'Upozornění na vadu' from description → defectsNote ===");
  console.log(`Mode: ${isApply ? "APPLY" : "DRY RUN"}`);

  const db = await createDb();
  try {
    const products = await db.product.findMany({
      select: { id: true, slug: true, name: true, description: true, defectsNote: true },
    });
    console.log(`DB: ${products.length} products`);

    let scanned = 0;
    let matched = 0;
    let updated = 0;
    let mergedExisting = 0;
    const samples: string[] = [];

    for (const p of products) {
      if (!p.description) continue;
      scanned++;
      const result = extractWarnings(p.description);
      if (!result) continue;
      matched++;

      const existingNote = (p.defectsNote ?? "").trim();
      const mergedNote = existingNote
        ? existingNote.includes(result.note)
          ? existingNote
          : `${existingNote}\n${result.note}`
        : result.note;

      if (existingNote) mergedExisting++;

      if (samples.length < 20) {
        samples.push(
          `• ${p.slug} — note: "${result.note.slice(0, 160)}${result.note.length > 160 ? "…" : ""}"`,
        );
      }

      if (isApply) {
        await db.product.update({
          where: { id: p.id },
          data: {
            defectsNote: mergedNote,
            description: result.cleanedDescription,
          },
        });
      }
      updated++;
    }

    console.log(`\nScanned:             ${scanned}`);
    console.log(`Matched:             ${matched}`);
    console.log(`Already had note:    ${mergedExisting}`);
    console.log(`Updates applied:     ${isApply ? updated : 0}`);

    if (samples.length) {
      console.log(`\nFirst ${samples.length} matches:`);
      for (const s of samples) console.log(s);
    }

    if (!isApply) console.log("\n🔍 DRY RUN — re-run with --apply to commit.");
    else console.log("\n✅ APPLY done.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
