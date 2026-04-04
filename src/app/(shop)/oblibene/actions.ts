"use server";

import { getDb } from "@/lib/db";

export interface WishlistProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  images: string;
  brand: string | null;
  condition: string;
  categoryName: string;
  sold: boolean;
}

export async function getWishlistProducts(
  productIds: string[]
): Promise<WishlistProduct[]> {
  if (productIds.length === 0) return [];

  // Cap input to prevent oversized IN queries from malicious clients
  const ids = productIds.slice(0, 100);

  const db = await getDb();
  const products = await db.product.findMany({
    where: { id: { in: ids }, active: true },
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAt: p.compareAt,
    images: p.images,
    brand: p.brand,
    condition: p.condition,
    categoryName: p.category.name,
    sold: p.sold,
  }));
}
