import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

type SeasonalCollection = {
  slug: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
};

const SEASONAL_COLLECTIONS: SeasonalCollection[] = [
  {
    slug: "den-matek-2026",
    title: "Dárek pro mámu — Den matek 2026",
    description:
      "Jedinečné kousky pro tu nejdůležitější ženu ve vašem životě.",
    startDate: new Date("2026-05-01T00:00:00+02:00"),
    endDate: new Date("2026-05-11T00:00:00+02:00"),
  },
];

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const results: Array<{ slug: string; action: "created" | "exists" }> = [];

  for (const c of SEASONAL_COLLECTIONS) {
    const existing = await db.collection.findUnique({
      where: { slug: c.slug },
      select: { id: true },
    });

    if (existing) {
      results.push({ slug: c.slug, action: "exists" });
      continue;
    }

    await db.collection.create({
      data: {
        title: c.title,
        description: c.description,
        slug: c.slug,
        productIds: "[]",
        featured: false,
        sortOrder: 0,
        active: true,
        startDate: c.startDate,
        endDate: c.endDate,
      },
    });
    results.push({ slug: c.slug, action: "created" });
  }

  revalidatePath("/admin/collections");
  revalidatePath("/");

  return NextResponse.json({ ok: true, results });
}
