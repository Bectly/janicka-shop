import { NextRequest, NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";
import { getImageUrls } from "@/lib/images";

export interface ShuffleProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  brand: string | null;
  condition: string;
  categoryName: string;
  sizes: string;
  colors: string;
  images: string[];
  stock: number;
  reservedUntil: string | null;
}

export async function GET(req: NextRequest) {
  await connection();
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 10, 1), 30);

  const excludeParam = req.nextUrl.searchParams.get("exclude") ?? "";
  const excludeIds = excludeParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 128)
    .slice(0, 500);

  const sizesParam = req.nextUrl.searchParams.get("sizes") ?? "";
  const wantedSizes = sizesParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 8 && /^[A-Za-z0-9.,/+\-_ ]+$/.test(s))
    .slice(0, 20);
  const wantedSizesSet = new Set(wantedSizes);

  const db = await getDb();
  const products = await db.product.findMany({
    where: {
      active: true,
      sold: false,
      ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      compareAt: true,
      brand: true,
      condition: true,
      sizes: true,
      colors: true,
      images: true,
      stock: true,
      reservedUntil: true,
      category: { select: { name: true } },
    },
  });

  // Filter by sizes (sizes stored as JSON string array on product)
  const filtered = wantedSizesSet.size > 0
    ? products.filter((p) => {
        try {
          const parsed = JSON.parse(p.sizes);
          if (!Array.isArray(parsed)) return false;
          return parsed.some((s: unknown) => typeof s === "string" && wantedSizesSet.has(s));
        } catch {
          return false;
        }
      })
    : products;

  // Fisher-Yates shuffle
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }

  const items: ShuffleProduct[] = filtered.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAt: p.compareAt,
    brand: p.brand,
    condition: p.condition,
    categoryName: p.category.name,
    sizes: p.sizes,
    colors: p.colors,
    images: getImageUrls(p.images),
    stock: p.stock,
    reservedUntil: p.reservedUntil ? p.reservedUntil.toISOString() : null,
  }));

  return NextResponse.json({ items });
}
