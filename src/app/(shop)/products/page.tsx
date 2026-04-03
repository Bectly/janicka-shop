import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import { ProductFilters } from "@/components/shop/product-filters";
import { Pagination } from "@/components/shop/pagination";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Katalog",
  description:
    "Prohlédněte si naši kolekci stylového oblečení pro moderní ženy.",
};

const PRODUCTS_PER_PAGE = 12;

interface SearchParams {
  category?: string;
  sort?: string;
  sale?: string;
  brand?: string | string[];
  size?: string | string[];
  condition?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  page?: string;
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);

  const brandFilter = toArray(params.brand);
  const sizeFilter = toArray(params.size);
  const conditionFilter = toArray(params.condition);
  const minPrice = params.minPrice ? parseFloat(params.minPrice) : null;
  const maxPrice = params.maxPrice ? parseFloat(params.maxPrice) : null;

  // Build Prisma where clause
  const where: Record<string, unknown> = { active: true, sold: false };

  if (params.category) {
    where.category = { slug: params.category };
  }
  if (params.sale === "true") {
    where.compareAt = { not: null };
  }
  if (brandFilter.length > 0) {
    where.brand = { in: brandFilter };
  }
  if (conditionFilter.length > 0) {
    where.condition = { in: conditionFilter };
  }
  if (minPrice !== null || maxPrice !== null) {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== null && !isNaN(minPrice)) priceFilter.gte = minPrice;
    if (maxPrice !== null && !isNaN(maxPrice)) priceFilter.lte = maxPrice;
    where.price = priceFilter;
  }

  const orderBy: Record<string, string> =
    params.sort === "price-asc"
      ? { price: "asc" }
      : params.sort === "price-desc"
        ? { price: "desc" }
        : { createdAt: "desc" };

  // Fetch products, categories, and filter options in parallel
  // Size filter requires JS-level filtering (JSON column), so we fetch all matching
  // products and paginate after filtering
  const [products, categories, distinctBrands, allSizes] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy,
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: { active: true, sold: false, brand: { not: null } },
      select: { brand: true },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true, sold: false },
      select: { sizes: true },
    }),
  ]);

  // Extract unique brands
  const brands = distinctBrands
    .map((p) => p.brand)
    .filter((b): b is string => b !== null && b !== "");

  // Extract unique sizes from JSON arrays
  const sizeSet = new Set<string>();
  for (const p of allSizes) {
    try {
      const parsed: string[] = JSON.parse(p.sizes);
      for (const s of parsed) if (s) sizeSet.add(s);
    } catch {
      // skip corrupted data
    }
  }
  const sizes = Array.from(sizeSet).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b, "cs");
  });

  // Apply size filter in JS (sizes stored as JSON string, not queryable via Prisma)
  const filteredProducts =
    sizeFilter.length > 0
      ? products.filter((p) => {
          try {
            const pSizes: string[] = JSON.parse(p.sizes);
            return sizeFilter.some((s) => pSizes.includes(s));
          } catch {
            return false;
          }
        })
      : products;

  // Paginate
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(
    startIndex,
    startIndex + PRODUCTS_PER_PAGE,
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          {params.category
            ? (categories.find((c) => c.slug === params.category)?.name ??
              "Katalog")
            : "Všechny produkty"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalItems}{" "}
          {totalItems === 1
            ? "produkt"
            : totalItems >= 2 && totalItems <= 4
              ? "produkty"
              : "produktů"}
          {totalPages > 1 && (
            <span>
              {" "}
              &middot; stránka {safePage} z {totalPages}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <Suspense fallback={null}>
        <ProductFilters
          brands={brands}
          sizes={sizes}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        />
      </Suspense>

      {/* Product grid */}
      <div className="mt-8">
        {paginatedProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {paginatedProducts.map((product) => (
              <ProductCard
                key={product.id}
                name={product.name}
                slug={product.slug}
                price={product.price}
                compareAt={product.compareAt}
                images={product.images}
                categoryName={product.category.name}
                brand={product.brand}
                condition={product.condition}
                isNew={product.createdAt > sevenDaysAgo}
              />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">
              Žádné produkty neodpovídají zvoleným filtrům.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <Suspense fallback={null}>
        <Pagination totalItems={totalItems} perPage={PRODUCTS_PER_PAGE} />
      </Suspense>
    </div>
  );
}
