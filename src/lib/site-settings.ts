import { getDb } from "@/lib/db";

export async function getSiteSetting(key: string): Promise<string | null> {
  try {
    const db = await getDb();
    const row = await db.siteSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSiteSetting(
  key: string,
  value: string | null,
): Promise<void> {
  const db = await getDb();
  if (!value) {
    await db.siteSetting.deleteMany({ where: { key } });
    return;
  }
  await db.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export const HERO_EDITORIAL_IMAGE_KEY = "hero_editorial_image";
