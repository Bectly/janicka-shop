import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/lib/auth";
import { getR2Client } from "@/lib/r2";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = await getClientIp();
  const rl = checkRateLimit(
    `claude-upload:${session.user.id ?? ip}`,
    20,
    60 * 1000,
  );
  if (!rl.success) {
    return NextResponse.json(
      { error: "Příliš mnoho uploadů — zkus to za chvíli." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor" }, { status: 400 });
  }

  const ext = MIME_EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Povolené typy: PNG, JPG, WebP" },
      { status: 400 },
    );
  }

  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Soubor musí být 1 B – 5 MB" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `claude-uploads/${randomUUID()}.${ext}`;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    return NextResponse.json(
      { error: "R2 není nakonfigurován" },
      { status: 500 },
    );
  }

  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }),
  );

  const expiresIn = 3600;
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn },
  );

  return NextResponse.json({
    url,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
}
