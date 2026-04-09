"use server";

import { getDb } from "@/lib/db";

export async function getProductQuickView(productId: string) {
  if (!productId || typeof productId !== "string" || productId.length > 128) return null;

  const db = await getDb();
  const product = await db.product.findUnique({
    where: { id: productId },
    include: { category: { select: { name: true, slug: true } } },
  });

  if (!product || !product.active) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    compareAt: product.compareAt,
    images: product.images,
    brand: product.brand,
    condition: product.condition,
    sizes: product.sizes,
    colors: product.colors,
    stock: product.stock,
    sold: product.sold,
    categoryName: product.category.name,
    reservedUntil: product.reservedUntil?.toISOString() ?? null,
  };
}
