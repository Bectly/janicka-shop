import { getDb } from "@/lib/db";

export async function getSiteSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.siteSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSiteSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
