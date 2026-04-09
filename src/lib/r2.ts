import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

function getR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

/**
 * Upload a file buffer to Cloudflare R2.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  folder = "products"
): Promise<string> {
  const R2 = getR2Client();
  // Sanitize filename — strip path traversal, keep only the base name
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 100);
  const key = `${folder}/${randomUUID()}-${safeName}`;

  await R2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/**
 * Delete a file from Cloudflare R2 by its public URL.
 * Silently skips URLs that don't belong to our bucket.
 */
export async function deleteFromR2(url: string): Promise<void> {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!publicUrl || !url.startsWith(publicUrl)) return;
  const R2 = getR2Client();
  const key = url.slice(publicUrl.length + 1);
  await R2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}
