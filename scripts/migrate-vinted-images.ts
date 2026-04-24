/**
 * Migrate Vinted-hosted Product images to our Cloudflare R2 bucket.
 *
 * Reads Product rows from Turso (prod) or local SQLite, downloads every image
 * URL hosted on `*.vinted.net` / `*.vinted.com`, uploads each one to R2 under
 * `products/{productId}/{sha256(url)[:16]}.{ext}`, then rewrites the
 * Product.images JSON column so the Vinted URLs are replaced by our R2
 * public URLs.
 *
 * Idempotent: URLs already pointing to our R2 public host are skipped.
 * `originalVintedData` + `originalDescription` are never touched.
 *
 * Usage:
 *   npx tsx scripts/migrate-vinted-images.ts --dry-run
 *   npx tsx scripts/migrate-vinted-images.ts --apply
 *   npx tsx scripts/migrate-vinted-images.ts --apply --limit 5   # test on 5 products
 *
 * Required env:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   NEXT_PUBLIC_R2_PUBLIC_URL (or R2_PUBLIC_URL)
 *   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN for prod, or DATABASE_URL for local.
 */

import { createClient, type Client } from "@libsql/client";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

const VINTED_HOST_RE = /^images\d*\.vinted\.(net|com)$/i;
const CONCURRENCY = 4;
const BATCH_SLEEP_MS = 150;
const MAX_RETRIES = 3;

type ImageItem = string | { url: string; alt?: string };

function publicR2Base(): string {
  const raw =
    process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";
  return raw.replace(/\/+$/, "");
}

function isR2Url(url: string): boolean {
  const base = publicR2Base();
  return !!base && url.startsWith(base + "/");
}

function isVintedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return VINTED_HOST_RE.test(u.hostname);
  } catch {
    return false;
  }
}

function makeDb(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (tursoUrl && tursoToken) {
    return createClient({ url: tursoUrl, authToken: tursoToken });
  }
  const fileUrl = process.env.DATABASE_URL?.trim() ?? "file:./prisma/dev.db";
  return createClient({ url: fileUrl });
}

function makeR2(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function parseImages(raw: string | null | undefined): ImageItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function itemUrl(item: ImageItem): string {
  return typeof item === "string" ? item : item?.url ?? "";
}

function replaceItemUrl(item: ImageItem, url: string): ImageItem {
  return typeof item === "string" ? url : { ...item, url };
}

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/\.([a-z0-9]{2,5})$/i);
    return m ? m[1].toLowerCase() : "webp";
  } catch {
    return "webp";
  }
}

function contentTypeFor(ext: string, fallback: string | null): string {
  const map: Record<string, string> = {
    webp: "image/webp",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    avif: "image/avif",
  };
  return map[ext] ?? fallback ?? "application/octet-stream";
}

async function downloadOnce(url: string): Promise<{
  buffer: Buffer;
  contentType: string | null;
}> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; JanickaShopMigrator/1.0; +https://janickashop.cz)",
      Accept: "image/webp,image/jpeg,image/png,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const ct = res.headers.get("content-type");
  const arr = await res.arrayBuffer();
  return { buffer: Buffer.from(arr), contentType: ct };
}

async function downloadWithRetry(url: string): Promise<{
  buffer: Buffer;
  contentType: string | null;
}> {
  let lastErr: unknown;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await downloadOnce(url);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function keyExists(r2: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

function buildKey(productId: string, url: string): { key: string; ext: string } {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const ext = extFromUrl(url);
  return { key: `products/${productId}/${hash}.${ext}`, ext };
}

async function uploadOne(
  r2: S3Client,
  bucket: string,
  productId: string,
  url: string,
): Promise<string> {
  const base = publicR2Base();
  if (!base) throw new Error("Missing R2 public URL env");
  const { key, ext } = buildKey(productId, url);

  if (await keyExists(r2, bucket, key)) {
    return `${base}/${key}`;
  }

  const { buffer, contentType } = await downloadWithRetry(url);
  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentTypeFor(ext, contentType),
    }),
  );
  return `${base}/${key}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

type ProductRow = {
  id: string;
  slug: string;
  images: string;
  defectImages: string;
};

function findVintedUrlsInField(raw: string): {
  items: ImageItem[];
  vintedIndices: number[];
} {
  const items = parseImages(raw);
  const vintedIndices: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const url = itemUrl(items[i]);
    if (url && isVintedUrl(url)) vintedIndices.push(i);
  }
  return { items, vintedIndices };
}

async function migrateField(
  r2: S3Client,
  bucket: string,
  productId: string,
  field: "images" | "defectImages",
  raw: string,
  apply: boolean,
): Promise<{ updated: string | null; migrated: number; failed: number }> {
  const { items, vintedIndices } = findVintedUrlsInField(raw);
  if (vintedIndices.length === 0) return { updated: null, migrated: 0, failed: 0 };

  const tasks = vintedIndices.map((idx) => async () => {
    const url = itemUrl(items[idx]);
    try {
      if (!apply) {
        // Dry-run: just compute the target key, don't upload.
        const { key } = buildKey(productId, url);
        return { idx, ok: true as const, newUrl: `${publicR2Base()}/${key}` };
      }
      const newUrl = await uploadOne(r2, bucket, productId, url);
      return { idx, ok: true as const, newUrl };
    } catch (err) {
      return { idx, ok: false as const, error: err instanceof Error ? err.message : String(err) };
    }
  });

  const results = await mapWithConcurrency(tasks, (t) => t(), CONCURRENCY);

  let migrated = 0;
  let failed = 0;
  const next: ImageItem[] = [...items];
  for (const r of results) {
    if (r.ok) {
      next[r.idx] = replaceItemUrl(next[r.idx], r.newUrl);
      migrated++;
    } else {
      failed++;
      console.error(`    [${field}] ${productId} idx=${r.idx}: ${r.error}`);
    }
  }
  await new Promise((rs) => setTimeout(rs, BATCH_SLEEP_MS));

  return { updated: JSON.stringify(next), migrated, failed };
}

async function main(): Promise<void> {
  const argv = new Set(process.argv.slice(2));
  const dryRun = argv.has("--dry-run") || !argv.has("--apply");
  const apply = argv.has("--apply") && !argv.has("--dry-run");

  const limitArgIdx = process.argv.indexOf("--limit");
  const limit =
    limitArgIdx > -1 && process.argv[limitArgIdx + 1]
      ? parseInt(process.argv[limitArgIdx + 1], 10)
      : Infinity;

  const target =
    process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN
      ? "Turso (prod)"
      : "local SQLite";

  console.log(`[migrate-vinted-images] target=${target} mode=${dryRun ? "DRY RUN" : "APPLY"}`);
  if (!Number.isFinite(limit)) {
    console.log(`[migrate-vinted-images] processing ALL rows`);
  } else {
    console.log(`[migrate-vinted-images] processing up to ${limit} rows`);
  }

  const base = publicR2Base();
  if (!base) {
    console.error("Missing R2 public URL (NEXT_PUBLIC_R2_PUBLIC_URL or R2_PUBLIC_URL). Aborting.");
    process.exit(1);
  }
  const bucket = process.env.R2_BUCKET_NAME;
  if (apply && !bucket) {
    console.error("Missing R2_BUCKET_NAME. Aborting apply.");
    process.exit(1);
  }
  if (apply && (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY)) {
    console.error("Missing R2 credentials. Aborting apply.");
    process.exit(1);
  }

  const db = makeDb();
  const r2 = apply ? makeR2() : (null as unknown as S3Client);

  const rows = (await db.execute(
    "SELECT id, slug, images, defectImages FROM Product",
  )).rows as unknown as ProductRow[];

  const candidates = rows
    .map((r) => {
      const imgInfo = findVintedUrlsInField(r.images);
      const defInfo = findVintedUrlsInField(r.defectImages);
      return { row: r, imgCount: imgInfo.vintedIndices.length, defCount: defInfo.vintedIndices.length };
    })
    .filter((c) => c.imgCount + c.defCount > 0);

  console.log(`Rows scanned: ${rows.length}`);
  console.log(`Rows with Vinted URLs: ${candidates.length}`);
  console.log(
    `Total Vinted URLs: ${candidates.reduce(
      (s, c) => s + c.imgCount + c.defCount,
      0,
    )} (images=${candidates.reduce((s, c) => s + c.imgCount, 0)}, defectImages=${candidates.reduce((s, c) => s + c.defCount, 0)})`,
  );

  if (dryRun) {
    console.log("\nSample (first 3 rows):");
    for (const c of candidates.slice(0, 3)) {
      console.log(`  - ${c.row.id} (${c.row.slug}): images=${c.imgCount} defectImages=${c.defCount}`);
      const items = parseImages(c.row.images);
      const firstVinted = items.find((it) => isVintedUrl(itemUrl(it)));
      if (firstVinted) {
        const url = itemUrl(firstVinted);
        const { key } = buildKey(c.row.id, url);
        console.log(`      src: ${url.slice(0, 100)}...`);
        console.log(`      dst: ${publicR2Base()}/${key}`);
      }
    }
    console.log("\n[DRY RUN] No network or DB writes performed. Re-run with --apply to migrate.");
    return;
  }

  // APPLY
  let productsUpdated = 0;
  let totalMigrated = 0;
  let totalFailed = 0;
  const processList = candidates.slice(0, Number.isFinite(limit) ? (limit as number) : candidates.length);

  for (let i = 0; i < processList.length; i++) {
    const c = processList[i];
    const { row } = c;
    console.log(`[${i + 1}/${processList.length}] ${row.id} (${row.slug}) — images=${c.imgCount} defectImages=${c.defCount}`);

    const imgRes = await migrateField(r2, bucket!, row.id, "images", row.images, true);
    const defRes = await migrateField(r2, bucket!, row.id, "defectImages", row.defectImages, true);

    totalMigrated += imgRes.migrated + defRes.migrated;
    totalFailed += imgRes.failed + defRes.failed;

    if (imgRes.updated || defRes.updated) {
      // Still retain any vinted URLs that failed — they stay unchanged — so a
      // re-run will retry them.
      await db.execute({
        sql: "UPDATE Product SET images = COALESCE(?, images), defectImages = COALESCE(?, defectImages) WHERE id = ?",
        args: [imgRes.updated, defRes.updated, row.id],
      });
      productsUpdated++;
    }
  }

  console.log("\n=== DONE ===");
  console.log(`Products updated: ${productsUpdated}`);
  console.log(`URLs migrated: ${totalMigrated}`);
  console.log(`URLs failed: ${totalFailed}`);
  if (totalFailed > 0) {
    console.log("Re-run the command to retry failed URLs (idempotent).");
  }
}

main().catch((err) => {
  console.error("[migrate-vinted-images] fatal:", err);
  process.exit(1);
});
