/**
 * Verification: assert that zero Product rows reference Vinted-hosted images
 * in either `images` or `defectImages`. Exits non-zero if any are found.
 *
 * Run after scripts/migrate-vinted-images.ts --apply, and in CI as a regression
 * guard.
 *
 * Usage:
 *   npx tsx scripts/verify-no-vinted-urls.ts
 */

import { createClient, type Client } from "@libsql/client";

function makeDb(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (tursoUrl && tursoToken) {
    return createClient({ url: tursoUrl, authToken: tursoToken });
  }
  const fileUrl = process.env.DATABASE_URL?.trim() ?? "file:./prisma/dev.db";
  return createClient({ url: fileUrl });
}

async function main(): Promise<void> {
  const db = makeDb();
  const target =
    process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
      ? "Turso (prod)"
      : "local SQLite";

  const res = await db.execute(`
    SELECT id, slug
    FROM Product
    WHERE images LIKE '%vinted.net%'
       OR images LIKE '%vinted.com%'
       OR defectImages LIKE '%vinted.net%'
       OR defectImages LIKE '%vinted.com%'
  `);

  const offending = res.rows as unknown as { id: string; slug: string }[];
  console.log(`[verify-no-vinted-urls] target=${target}`);
  console.log(`Offending rows: ${offending.length}`);
  for (const r of offending.slice(0, 10)) {
    console.log(`  - ${r.id} (${r.slug})`);
  }
  if (offending.length > 10) console.log(`  ... and ${offending.length - 10} more`);

  if (offending.length > 0) {
    console.error("FAIL: Vinted URLs still present in Product table.");
    process.exit(1);
  }
  console.log("OK: zero Vinted URLs in Product.images / Product.defectImages.");
}

main().catch((err) => {
  console.error("[verify-no-vinted-urls] fatal:", err);
  process.exit(1);
});
