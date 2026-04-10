import Link from "next/link";
import { Search } from "lucide-react";
import { getDb } from "@/lib/db";
import { getLowestPrices30d } from "@/lib/price-history";
import { ProductCard } from "@/components/shop/product-card";
import { ProductListItem } from "@/components/shop/product-list-item";
import { buildItemListSchema, jsonLdString } from "@/lib/structured-data";
import type { ViewMode } from "@/components/shop/grid-view-switcher";
import type { Prisma } from "@prisma/client";

const PRODUCTS_PER_PAGE = 12;

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: { select: { name: true } } };
}>;

function parseJsonArray(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

interface ProductGridProps {
  searchParams: {
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
    view?: string;
  };
  categoryName: string;
}

const VIEW_GRID_CLASSES: Record<ViewMode, string> = {
  "grid-2": "grid grid-cols-2 gap-4 sm:gap-5 lg:gap-6",
  "grid-3": "grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6",
  list: "flex flex-col gap-3",
};

export async function ProductGrid({
  searchParams: params,
  categoryName,
}: ProductGridProps) {
  const db = await getDb();
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);

  const brandFilter = toArray(params.brand);
  const sizeFilter = toArray(params.size);
  const conditionFilter = toArray(params.condition);
  const colorFilter = toArray(params.color);
  const rawMinPrice = params.minPrice ? parseFloat(params.minPrice) : null;
  const rawMaxPrice = params.maxPrice ? parseFloat(params.maxPrice) : null;
  const minPrice =
    rawMinPrice !== null && !isNaN(rawMinPrice)
      ? Math.max(0, Math.min(999999, rawMinPrice))
      : null;
  const maxPrice =
    rawMaxPrice !== null && !isNaN(rawMaxPrice)
      ? Math.max(0, Math.min(999999, rawMaxPrice))
      : null;

  // Build Prisma where clause
  const where: Record<string, unknown> = { active: true, sold: false };
  if (params.category) where.category = { slug: params.category };
  if (params.sale === "true") where.compareAt = { not: null };
  if (brandFilter.length > 0) where.brand = { in: brandFilter };
  if (conditionFilter.length > 0) where.condition = { in: conditionFilter };
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

  const hasJsFilter =
    sizeFilter.length > 0 || colorFilter.length > 0 || isDiscountSort;

  let paginatedProducts: ProductWithCategory[];

  if (hasJsFilter) {
    // Size/color filters require JS-level filtering (JSON columns not queryable via Prisma/SQLite).
    const allProducts = await db.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy,
      take: 2000,
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
    if (isDiscountSort) {
      filteredProducts = filteredProducts.sort((a, b) => {
        const dA =
          a.compareAt && a.compareAt > a.price
            ? (a.compareAt - a.price) / a.compareAt
            : 0;
        const dB =
          b.compareAt && b.compareAt > b.price
            ? (b.compareAt - b.price) / b.compareAt
            : 0;
        return dB - dA;
      });
    }
    const totalItems = filteredProducts.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * PRODUCTS_PER_PAGE;
    paginatedProducts = filteredProducts.slice(
      startIndex,
      startIndex + PRODUCTS_PER_PAGE,
    );
  } else {
    // No size/color filter — efficient DB-level pagination
    paginatedProducts = await db.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy,
      skip: (Math.max(1, currentPage) - 1) * PRODUCTS_PER_PAGE,
      take: PRODUCTS_PER_PAGE,
    });
  }

  if (paginatedProducts.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-5 inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 via-champagne-light/30 to-blush-light/40">
          <Search className="size-7 text-brand/50" aria-hidden="true" />
        </div>
        <h3 className="font-heading text-lg font-semibold text-foreground">
          Nic nenalezeno
        </h3>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          Žádné produkty neodpovídají zvoleným filtrům.
        </p>
        <Link
          href="/products"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <span aria-hidden="true">↩</span>
          Zobrazit vše
        </Link>
      </div>
    );
  }

  // 30-day lowest prices for displayed products (Czech "fake discount" law)
  const lowestPricesMap = await getLowestPrices30d(
    paginatedProducts.map((p) => p.id),
  );

  // JSON-LD ItemList for product listing (Google Shopping + AI search)
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
      compareAt: p.compareAt,
      sold: p.sold,
      categoryName: p.category.name,
      colors: p.colors,
      sizes: p.sizes,
    })),
    categoryName,
    `/products${params.category ? `?category=${params.category}` : ""}`,
  );

  const viewMode: ViewMode =
    params.view === "grid-2" || params.view === "list"
      ? params.view
      : "grid-3";
  const isListView = viewMode === "list";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
      />
      <div className={VIEW_GRID_CLASSES[viewMode]}>
        {paginatedProducts.map((product, i) => {
          const isEditorial = !isListView && (product.featured || i === 0 || i === 5);

          if (isListView) {
            return (
              <div
                key={product.id}
                className="animate-fade-up-scroll"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <ProductListItem
                  id={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  compareAt={product.compareAt}
                  images={product.images}
                  categoryName={product.category.name}
                  brand={product.brand}
                  condition={product.condition}
                  sizes={product.sizes}
                  colors={product.colors}
                  stock={product.stock}
                  createdAt={product.createdAt.toISOString()}
                  isReserved={false}
                  lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                  priority={i < 4}
                />
              </div>
            );
          }

          return (
            <div
              key={product.id}
              className={`animate-fade-up-scroll${isEditorial ? " col-span-2" : ""}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <ProductCard
                id={product.id}
                name={product.name}
                slug={product.slug}
                price={product.price}
                compareAt={product.compareAt}
                images={product.images}
                categoryName={product.category.name}
                brand={product.brand}
                condition={product.condition}
                sizes={product.sizes}
                colors={product.colors}
                stock={product.stock}
                createdAt={product.createdAt.toISOString()}
                isReserved={false}
                lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                priority={i < 4}
                variant={isEditorial ? "featured" : "standard"}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
