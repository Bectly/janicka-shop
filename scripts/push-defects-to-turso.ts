import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const TURSO_URL = process.env.TURSO_DATABASE_URL!.replace("libsql://", "https://");
const TOKEN = process.env.TURSO_AUTH_TOKEN!;
const PIPELINE = `${TURSO_URL}/v2/pipeline`;

type Row = { slug: string; defectsNote: string };

async function pipeline(requests: unknown[]) {
  const res = await fetch(PIPELINE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const dbPath = path.resolve("prisma/dev.db");
  const out = execFileSync(
    "sqlite3",
    [
      dbPath,
      "-json",
      "SELECT slug, defectsNote FROM Product WHERE defectsNote IS NOT NULL AND defectsNote != ''",
    ],
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }
  );
  const rows = JSON.parse(out) as Row[];
  console.log(`Read ${rows.length} products with defectsNote from dev.db`);

  let updated = 0;
  let missing = 0;
  const BATCH = 20;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const requests: unknown[] = slice.map((r) => ({
      type: "execute",
      stmt: {
        sql: "UPDATE Product SET defectsNote = ? WHERE slug = ?",
        args: [
          { type: "text", value: r.defectsNote },
          { type: "text", value: r.slug },
        ],
      },
    }));
    requests.push({ type: "close" });
    const json = await pipeline(requests);
    for (let j = 0; j < slice.length; j++) {
      const r = json.results[j];
      const affected = r?.response?.result?.affected_row_count ?? 0;
      if (affected > 0) updated++;
      else {
        missing++;
        console.warn(`  no match for slug: ${slice[j].slug}`);
      }
    }
    console.log(`  batch ${i / BATCH + 1}: updated=${updated} missing=${missing}`);
  }

  const verify = await pipeline([
    {
      type: "execute",
      stmt: {
        sql: "SELECT COUNT(*) AS c FROM Product WHERE defectsNote IS NOT NULL AND LENGTH(defectsNote) > 0",
      },
    },
    { type: "close" },
  ]);
  const count = verify.results[0].response.result.rows[0][0].value;
  console.log(`\nDONE — Turso defectsNote count: ${count} (updated=${updated} missing=${missing})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
