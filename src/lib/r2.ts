import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
