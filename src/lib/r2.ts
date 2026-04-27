import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

export function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export type R2UploadResult = { key: string; url: string };

/**
 * Upload a file buffer to Cloudflare R2.
 * Returns the canonical object key and its public URL. Callers that only need
 * the URL can destructure `{ url }`; callers that persist the key (e.g. for
 * signed downloads) must use the returned `key` — fabricating one drifts from
 * the actual object path.
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder = "products",
  explicitKey?: string
): Promise<R2UploadResult> {
  const R2 = getR2Client();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
  const key = explicitKey ?? `${folder}/${randomUUID()}-${safeName}`;

  await R2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  const publicUrl =
    process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  return { key, url: `${publicUrl}/${key}` };
}

export function getR2PublicUrl(): string {
  const publicUrl =
    process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!publicUrl) throw new Error("R2_PUBLIC_URL not configured");
  return publicUrl.replace(/\/+$/, "");
}

export function buildR2Url(key: string): string {
  return `${getR2PublicUrl()}/${key.replace(/^\/+/, "")}`;
}

/**
 * Extracts the R2 object key from a public URL. Returns null when the URL is
 * not hosted on the configured R2 public origin (e.g. legacy UploadThing URLs).
 */
export function extractR2Key(url: string): string | null {
  let publicUrl: string;
  try {
    publicUrl = getR2PublicUrl();
  } catch {
    return null;
  }
  if (!url.startsWith(publicUrl + "/")) return null;
  return url.slice(publicUrl.length + 1);
}

export async function copyR2Object(srcKey: string, destKey: string): Promise<void> {
  const bucket = process.env.R2_BUCKET_NAME!;
  const R2 = getR2Client();
  await R2.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${encodeURIComponent(srcKey).replace(/%2F/g, "/")}`,
      Key: destKey,
    })
  );
}

export async function deleteR2Object(key: string): Promise<void> {
  const R2 = getR2Client();
  await R2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}

/**
 * Copy an R2 object from drafts/ to products/ and delete the original.
 * Returns the new public URL. If srcUrl is not an R2 object under drafts/,
 * returns the original URL unchanged (no-op for legacy or already-published images).
 */
export async function moveDraftImageToProducts(srcUrl: string): Promise<string> {
  const srcKey = extractR2Key(srcUrl);
  if (!srcKey || !srcKey.startsWith("drafts/")) return srcUrl;
  const destKey = `products/${srcKey.slice("drafts/".length)}`;
  await copyR2Object(srcKey, destKey);
  try {
    await deleteR2Object(srcKey);
  } catch {
    /* swallow — orphan cleanup cron handles this */
  }
  return buildR2Url(destKey);
}
