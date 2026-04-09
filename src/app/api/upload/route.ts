import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
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
    const folder = isVideo ? "videos" : "products";
    const url = await uploadToR2(buffer, file.name, file.type, folder);
    urls.push(url);
  }

  return NextResponse.json({ urls });
}
