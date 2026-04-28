import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadImage } from "@/lib/image-storage";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB
const MAX_VIDEO_SIZE = 32 * 1024 * 1024; // 32 MB
const MAX_FILES = 10;

/**
 * Validate file content against magic bytes to prevent MIME type spoofing.
 * The client-declared Content-Type is untrusted — this checks actual file signatures.
 */
function validateMagicBytes(buffer: Buffer, declaredType: string): boolean {
  if (buffer.length < 12) return false;

  switch (declaredType) {
    case "image/jpeg":
    case "image/jpg":
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );
    case "image/webp":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "image/gif":
      return buffer.subarray(0, 4).toString("ascii") === "GIF8";
    case "image/avif":
      // ISOBMFF container: "ftyp" at offset 4, then avif/avis/mif1
      return buffer.subarray(4, 8).toString("ascii") === "ftyp";
    case "video/mp4":
    case "video/quicktime":
      // ISOBMFF container: "ftyp" at offset 4
      return buffer.subarray(4, 8).toString("ascii") === "ftyp";
    case "video/webm":
      // EBML header
      return (
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3
      );
    default:
      return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  // Rate limit: 20 upload requests per minute per IP
  const ip = await getClientIp();
  const rl = checkRateLimit(`upload:${ip}`, 20, 60 * 1000);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Příliš mnoho požadavků. Zkuste to za chvíli." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Neplatný požadavek" },
      { status: 400 }
    );
  }

  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json(
      { error: "Žádné soubory nebyly nahrány" },
      { status: 400 }
    );
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximálně ${MAX_FILES} souborů najednou` },
      { status: 400 }
    );
  }

  const urls: string[] = [];

  for (const file of files) {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        {
          error: `Nepodporovaný formát: ${file.type}. Povoleny jsou obrázky (JPEG, PNG, WebP) a videa (MP4, WebM).`,
        },
        { status: 400 }
      );
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      return NextResponse.json(
        { error: `Soubor ${file.name} je příliš velký. Maximum: ${maxMB} MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate actual file content matches declared MIME type
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        {
          error: `Soubor ${file.name} neodpovídá deklarovanému typu ${file.type}.`,
        },
        { status: 400 }
      );
    }

    const folder = isVideo ? "videos" : "products";
    const { url } = await uploadImage(buffer, file.name, file.type, folder);
    urls.push(url);
  }

  return NextResponse.json({ urls });
}
