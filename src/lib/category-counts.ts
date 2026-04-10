import { getDb } from "@/lib/db";

export interface CategoryWithCount {
  slug: string;
  name: string;
  count: number;
}

/**
 * Returns all categories with their active (non-sold) product counts.
 * Called from HeaderNav (inside Suspense) — rendered dynamically via PPR.
 */
export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
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
