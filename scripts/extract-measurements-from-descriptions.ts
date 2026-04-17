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
import {
  extractMeasurements,
  hasAnyMeasurement,
  parseExistingMeasurements,
  type ExtractedMeasurements,
  type MeasurementField,
} from "../src/lib/measurements-extractor";

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

// Extraction logic lives in src/lib/measurements-extractor.ts (shared with the
// admin Server Action). This script only adds CLI orchestration (dry-run/apply).
type Field = MeasurementField;
type Extracted = ExtractedMeasurements;
const hasAny = hasAnyMeasurement;
const parseExisting = parseExistingMeasurements;

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
