import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";

export interface CategoryWithCount {
  slug: string;
  name: string;
  count: number;
}

/**
 * Returns all categories with their active (non-sold) product counts.
 * Cached for 30s, shared across all users — used by header navigation.
 */
export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");

  const db = await getDb();
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      _count: {
        select: {
          products: { where: { active: true, sold: false } },
        },
      },
    },
  });

  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    count: c._count.products,
  }));
}
