/**
 * Backfill Czech alt-text + caption for existing product images via Gemini Flash.
 *
 *   npx tsx scripts/backfill-alt-text.ts                # dry-run against Turso
 *   npx tsx scripts/backfill-alt-text.ts --write        # apply to Turso
 *   npx tsx scripts/backfill-alt-text.ts --local        # dry-run against prisma/dev.db
 *   npx tsx scripts/backfill-alt-text.ts --local --write
 *   npx tsx scripts/backfill-alt-text.ts --force        # overwrite existing alt-text
 *   npx tsx scripts/backfill-alt-text.ts --limit 50     # cap products processed
 *
 * Requires GEMINI_API_KEY in env. Cost: ~$0.0001 per image at Flash rates.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { generateAltText } from "../src/lib/ai/gemini-alt-text";
import { parseProductImages } from "../src/lib/images";

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  condition: string;
  sizes: string;
  images: string;
  categoryName: string;
}

async function main() {
  const WRITE = process.argv.includes("--write");
  const LOCAL = process.argv.includes("--local");
  const FORCE = process.argv.includes("--force");
  const limitArgIdx = process.argv.indexOf("--limit");
  const LIMIT = limitArgIdx >= 0 ? parseInt(process.argv[limitArgIdx + 1] || "0", 10) : 0;

  if (!process.env.GEMINI_API_KEY) {
    console.error("✗ GEMINI_API_KEY not set in env");
    process.exit(1);
  }

  const client = LOCAL
    ? createClient({ url: "file:prisma/dev.db" })
    : createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      });

  const sql = `
    SELECT p.id, p.name, p.brand, p.condition, p.sizes, p.images, c.name AS categoryName
    FROM Product p
    JOIN Category c ON p.categoryId = c.id
    WHERE p.active = 1
    ORDER BY p.createdAt DESC
    ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ""}
  `;
  const res = await client.execute(sql);

  console.log(
    `Mode: ${WRITE ? "WRITE" : "DRY-RUN"} | DB: ${LOCAL ? "local" : "Turso"} | Force: ${FORCE} | Products: ${res.rows.length}`,
  );

  let totalImages = 0,
    generated = 0,
    skipped = 0,
    failed = 0;

  for (const row of res.rows as unknown as ProductRow[]) {
    const images = parseProductImages(row.images);
    if (images.length === 0) continue;

    let sizes: string[] = [];
    try {
      sizes = JSON.parse(row.sizes);
    } catch {
      /* */
    }

    let productChanged = false;
    const next = [];
    for (const img of images) {
      totalImages++;
      if (!FORCE && img.alt) {
        skipped++;
        next.push(img);
        continue;
      }
      const out = await generateAltText({
        imageUrl: img.url,
        productName: row.name,
        brand: row.brand,
        condition: row.condition,
        sizes,
        categoryName: row.categoryName,
      });
      if (!out) {
        failed++;
        next.push(img);
        continue;
      }
      generated++;
      productChanged = true;
      next.push({ url: img.url, alt: out.altText, caption: out.caption });
      console.log(`  ✓ ${row.name.slice(0, 40).padEnd(40)} | ${out.altText.slice(0, 60)}`);
      // Small delay to be polite to the API (1 req/sec is generous)
      await new Promise((r) => setTimeout(r, 250));
    }

    if (productChanged && WRITE) {
      await client.execute({
        sql: "UPDATE Product SET images = ? WHERE id = ?",
        args: [JSON.stringify(next), row.id],
      });
    }
  }

  console.log(
    `\nDone. Images: ${totalImages} | Generated: ${generated} | Skipped: ${skipped} | Failed: ${failed}`,
  );
  if (!WRITE && generated > 0) {
    console.log("→ Re-run with --write to persist changes.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
