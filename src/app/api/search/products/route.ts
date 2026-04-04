import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Lightweight product index for client-side MiniSearch.
 * Returns only fields needed for instant search — id, name, slug, brand,
 * price, compareAt, condition, categoryName, first image, sizes, colors.
 * Cached via Next.js fetch cache + CDN for 60s.
 */
export async function GET() {
  const db = await getDb();

  const products = await db.product.findMany({
    where: { active: true, sold: false },
    select: {
      id: true,
      name: true,
      slug: true,
      brand: true,
      price: true,
      compareAt: true,
      condition: true,
      images: true,
      sizes: true,
      colors: true,
      category: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const items = products.map((p) => {
    let firstImage = "";
    try {
      const imgs: string[] = JSON.parse(p.images);
      firstImage = imgs[0] ?? "";
    } catch { /* fallback */ }

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand ?? "",
      price: p.price,
      compareAt: p.compareAt,
      condition: p.condition,
      category: p.category.name,
      image: firstImage,
      sizes: p.sizes,
      colors: p.colors,
    };
  });

  return NextResponse.json(items, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
