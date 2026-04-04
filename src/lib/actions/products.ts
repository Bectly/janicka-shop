"use server";

import { prisma } from "@/lib/db";
import { getVisitorId } from "@/lib/visitor";

export async function getProductQuickView(productId: string) {
  if (!productId || typeof productId !== "string") return null;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: { select: { name: true, slug: true } } },
  });

  if (!product || !product.active) return null;

  const visitorId = await getVisitorId();
  const now = new Date();
  const isReservedByOther =
    !!product.reservedUntil &&
    product.reservedUntil > now &&
    product.reservedBy !== visitorId;

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
    reservedByOther: isReservedByOther,
  };
}
