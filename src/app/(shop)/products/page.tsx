import { Suspense } from "react";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ProductCard } from "@/components/shop/product-card";
import { ProductFilters } from "@/components/shop/product-filters";
import { Pagination } from "@/components/shop/pagination";
import { getVisitorId } from "@/lib/visitor";
import { getLowestPrices30d } from "@/lib/price-history";
import { buildItemListSchema, buildBreadcrumbSchema, jsonLdString } from "@/lib/structured-data";
import type { Metadata } from "next";

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: { select: { name: true } } };
}>;

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
  color?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  page?: string;
}

/** Safely parse a JSON string array, returning [] on failure. */
function parseJsonArray(json: string): string[] {
  try { return JSON.parse(json); } catch { return []; }
}

/** Compute faceted filter counts from all products. Each facet count excludes its own filter. */
function computeFilterCounts(
  products: { brand: string | null; sizes: string; colors: string; condition: string; price: number; compareAt: number | null; category: { slug: string } }[],
  filters: { category?: string; sale?: string; brands: string[]; sizes: string[]; conditions: string[]; colors: string[]; minPrice: number | null; maxPrice: number | null },
) {
  const brandCounts: Record<string, number> = {};
  const sizeCounts: Record<string, number> = {};
  const conditionCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};

  for (const p of products) {
    // Base filters (category, sale, price) — always applied
    if (filters.category && p.category.slug !== filters.category) continue;
    if (filters.sale === "true" && !p.compareAt) continue;
    if (filters.minPrice !== null && p.price < filters.minPrice) continue;
    if (filters.maxPrice !== null && p.price > filters.maxPrice) continue;

    const pSizes = parseJsonArray(p.sizes);
    const pColors = parseJsonArray(p.colors);

    const matchesBrand = filters.brands.length === 0 || (!!p.brand && filters.brands.includes(p.brand));
    const matchesSize = filters.sizes.length === 0 || filters.sizes.some((s) => pSizes.includes(s));
    const matchesCond = filters.conditions.length === 0 || filters.conditions.includes(p.condition);
    const matchesColor = filters.colors.length === 0 || filters.colors.some((c) => pColors.includes(c));

    // Brand counts: all filters EXCEPT brand
    if (matchesSize && matchesCond && matchesColor && p.brand) {
      brandCounts[p.brand] = (brandCounts[p.brand] ?? 0) + 1;
    }
    // Size counts: all filters EXCEPT size
    if (matchesBrand && matchesCond && matchesColor) {
      for (const s of pSizes) if (s) sizeCounts[s] = (sizeCounts[s] ?? 0) + 1;
    }
    // Condition counts: all filters EXCEPT condition
    if (matchesBrand && matchesSize && matchesColor) {
      conditionCounts[p.condition] = (conditionCounts[p.condition] ?? 0) + 1;
    }
    // Color counts: all filters EXCEPT color
    if (matchesBrand && matchesSize && matchesCond) {
      for (const c of pColors) if (c) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
  }

  return { brands: brandCounts, sizes: sizeCounts, conditions: conditionCounts, colors: colorCounts };
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
  const colorFilter = toArray(params.color);
  const rawMinPrice = params.minPrice ? parseFloat(params.minPrice) : null;
  const rawMaxPrice = params.maxPrice ? parseFloat(params.maxPrice) : null;
  const minPrice = rawMinPrice !== null && !isNaN(rawMinPrice) ? Math.max(0, Math.min(999999, rawMinPrice)) : null;
  const maxPrice = rawMaxPrice !== null && !isNaN(rawMaxPrice) ? Math.max(0, Math.min(999999, rawMaxPrice)) : null;

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
    if (minPrice !== null) priceFilter.gte = minPrice;
    if (maxPrice !== null) priceFilter.lte = maxPrice;
    where.price = priceFilter;
  }

  const isDiscountSort = params.sort === "discount";
  const orderBy: Record<string, string> =
    params.sort === "price-asc"
      ? { price: "asc" }
      : params.sort === "price-desc"
        ? { price: "desc" }
        : { createdAt: "desc" };

  const hasJsFilter = sizeFilter.length > 0 || colorFilter.length > 0 || isDiscountSort;

  // Fetch categories + all products for filter facets in parallel
  const [categories, countingProducts] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: { active: true, sold: false },
      select: {
        brand: true,
        sizes: true,
        colors: true,
        condition: true,
        price: true,
        compareAt: true,
        category: { select: { slug: true } },
      },
    }),
  ]);

  // Extract unique brands (sorted alphabetically)
  const brandSet = new Set<string>();
  const sizeSet = new Set<string>();
  const colorSet = new Set<string>();
  for (const p of countingProducts) {
    if (p.brand) brandSet.add(p.brand);
    for (const s of parseJsonArray(p.sizes)) if (s) sizeSet.add(s);
    for (const c of parseJsonArray(p.colors)) if (c) colorSet.add(c);
  }
  const brands = Array.from(brandSet).sort((a, b) => a.localeCompare(b, "cs"));
  const sizes = Array.from(sizeSet).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b, "cs");
  });
  const colors = Array.from(colorSet).sort((a, b) => a.localeCompare(b, "cs"));

  // Compute faceted filter counts
  const filterCounts = computeFilterCounts(countingProducts, {
    category: params.category,
    sale: params.sale,
    brands: brandFilter,
    sizes: sizeFilter,
    conditions: conditionFilter,
    colors: colorFilter,
    minPrice,
    maxPrice,
  });

  let paginatedProducts: ProductWithCategory[];
  let totalItems: number;

  if (hasJsFilter) {
    // Size/color filters require JS-level filtering (JSON columns not queryable via Prisma/SQLite).
    // Fetch ALL matching products, filter in JS, then paginate.
    const allProducts = await prisma.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy,
    });
    let filteredProducts = allProducts.filter((p) => {
      if (sizeFilter.length > 0) {
        const pSizes = parseJsonArray(p.sizes);
        if (!sizeFilter.some((s) => pSizes.includes(s))) return false;
      }
      if (colorFilter.length > 0) {
        const pColors = parseJsonArray(p.colors);
        if (!colorFilter.some((c) => pColors.includes(c))) return false;
      }
      return true;
    });
    // Sort by discount % (products with discounts first, then by % descending)
    if (isDiscountSort) {
      filteredProducts = filteredProducts.sort((a, b) => {
        const dA = a.compareAt && a.compareAt > a.price ? (a.compareAt - a.price) / a.compareAt : 0;
        const dB = b.compareAt && b.compareAt > b.price ? (b.compareAt - b.price) / b.compareAt : 0;
        return dB - dA;
      });
    }
    totalItems = filteredProducts.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * PRODUCTS_PER_PAGE;
    paginatedProducts = filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  } else {
    // No size filter — use DB-level count + skip/take for efficient pagination
    const [count, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy,
        skip: (Math.max(1, currentPage) - 1) * PRODUCTS_PER_PAGE,
        take: PRODUCTS_PER_PAGE,
      }),
    ]);
    totalItems = count;
    paginatedProducts = products;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Check reservation status and 30-day lowest prices for displayed products
  const visitorId = await getVisitorId();
  const now = new Date();
  const lowestPricesMap = await getLowestPrices30d(
    paginatedProducts.map((p) => p.id),
  );

  // Build JSON-LD ItemList for product listing (Google Shopping + AI search)
  const categoryName = params.category
    ? (categories.find((c) => c.slug === params.category)?.name ?? "Katalog")
    : "Všechny produkty";
  const itemListJsonLd = buildItemListSchema(
    paginatedProducts.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      images: p.images,
      sku: p.sku,
      brand: p.brand,
      condition: p.condition,
      price: p.price,
      sold: p.sold,
      categoryName: p.category.name,
    })),
    categoryName,
    `/products${params.category ? `?category=${params.category}` : ""}`,
  );

  const breadcrumbItems = [{ name: "Katalog", url: "/products" }];
  if (params.category) {
    breadcrumbItems.push({
      name: categoryName,
      url: `/products?category=${params.category}`,
    });
  }
  const breadcrumbJsonLd = buildBreadcrumbSchema(breadcrumbItems);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }}
      />
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          {categoryName}
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
          colors={colors}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          counts={filterCounts}
          totalFiltered={totalItems}
        />
      </Suspense>

      {/* Product grid */}
      <div className="mt-8">
        {paginatedProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {paginatedProducts.map((product) => {
              const isReserved =
                !!product.reservedUntil &&
                product.reservedUntil > now &&
                product.reservedBy !== visitorId;
              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  compareAt={product.compareAt}
                  images={product.images}
                  categoryName={product.category.name}
                  brand={product.brand}
                  condition={product.condition}
                  isNew={product.createdAt > sevenDaysAgo}
                  isReserved={isReserved}
                  lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                />
              );
            })}
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
