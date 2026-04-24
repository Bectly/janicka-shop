/**
 * Read-only audit of Product.images URLs against R2 config.
 *
 * Reports:
 *   - rows with 'undefined/' prefix in any image URL
 *   - rows with missing scheme (no 'https://')
 *   - rows that reference our R2 bucket name but use a different public host
 *
 * No mutations. --fix is accepted but currently a no-op placeholder for a
 * future data-repair task (will be implemented after Trace #413 confirms scope).
 *
 * Usage:
 *   npx tsx scripts/audit-r2-image-urls.ts
 *   npx tsx scripts/audit-r2-image-urls.ts --fix   # no-op placeholder
 *
 * Turso: requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 * Local: falls back to prisma/dev.db via DATABASE_URL.
 */

import { createClient, type Client } from "@libsql/client";

type Row = { id: string; slug: string; images: string };

type Findings = {
  undefinedPrefix: Row[];
  missingScheme: Row[];
  wrongHost: Row[];
};

function expectedHost(): string | null {
  const publicUrl =
    process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!publicUrl) return null;
  try {
    return new URL(publicUrl).host;
  } catch {
    return null;
  }
}

function makeDb(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (tursoUrl && tursoToken) {
    return createClient({ url: tursoUrl, authToken: tursoToken });
  }
  // Local fallback — point libsql at the SQLite file directly.
  const fileUrl =
    process.env.DATABASE_URL?.replace(/^file:/, "file:") ??
    "file:./prisma/dev.db";
  return createClient({ url: fileUrl });
}

function parseImages(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function audit(): Promise<Findings> {
  const db = makeDb();
  const bucket = process.env.R2_BUCKET_NAME?.trim() ?? "";
  const host = expectedHost();

  const result = await db.execute("SELECT id, slug, images FROM Product");

  const findings: Findings = {
    undefinedPrefix: [],
    missingScheme: [],
    wrongHost: [],
  };

  for (const r of result.rows as unknown as Row[]) {
    const urls = parseImages(r.images);
    if (urls.length === 0) continue;

    if (urls.some((u) => u.includes("undefined/"))) {
      findings.undefinedPrefix.push(r);
    }
    if (urls.some((u) => !/^https?:\/\//i.test(u))) {
      findings.missingScheme.push(r);
    }
    if (host && bucket) {
      const wrong = urls.some((u) => {
        if (!u.includes(bucket)) return false;
        try {
          return new URL(u).host !== host;
        } catch {
          return true;
        }
      });
      if (wrong) findings.wrongHost.push(r);
    }
  }

  return findings;
}

function summarize(label: string, rows: Row[]): void {
  console.log(`  ${label}: ${rows.length}`);
  for (const r of rows.slice(0, 5)) {
    console.log(`    - ${r.id} (${r.slug})`);
  }
  if (rows.length > 5) console.log(`    ... and ${rows.length - 5} more`);
}

async function main(): Promise<void> {
  const fix = process.argv.includes("--fix");
  const target =
    process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
      ? "Turso (prod)"
      : "local SQLite";

  console.log(`[audit-r2-image-urls] target=${target}`);
  if (fix) {
    console.log("[audit-r2-image-urls] --fix accepted (no-op placeholder; data-repair lands in a follow-up task)");
  }

  const findings = await audit();
  console.log("Findings:");
  summarize("rows with 'undefined/' prefix", findings.undefinedPrefix);
  summarize("rows with missing scheme", findings.missingScheme);
  summarize("rows with bucket name on wrong public host", findings.wrongHost);

  const total =
    findings.undefinedPrefix.length +
    findings.missingScheme.length +
    findings.wrongHost.length;
  console.log(`Total flagged rows: ${total}`);
}

main().catch((err) => {
  console.error("[audit-r2-image-urls] failed:", err);
  process.exit(1);
});
