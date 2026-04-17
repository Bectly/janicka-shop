import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { ProductFilters } from "@/components/shop/product-filters";
import { Pagination } from "@/components/shop/pagination";
import { ProductGrid } from "./product-grid";
import { CategoryHero, CatalogHero } from "@/components/shop/category-hero";
import { GridViewSwitcher } from "@/components/shop/grid-view-switcher";
import { StickyCategoryNav } from "@/components/shop/sticky-category-nav";
import { buildBreadcrumbSchema, jsonLdString } from "@/lib/structured-data";
import { ALL_SIZES, getSizesForCategory } from "@/lib/sizes";
import { Skeleton } from "@/components/ui/skeleton";
import type { Metadata } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;

  if (params.category) {
    const db = await getDb();
    const category = await db.category.findUnique({
      where: { slug: params.category },
      select: { name: true, description: true },
    });

    if (category) {
      const title = `${category.name} — Katalog`;
      const description =
        category.description ??
        `Prohlédněte si naši kolekci ${category.name.toLowerCase()}. Unikátní second hand kousky za zlomek ceny.`;
      const canonicalUrl = `${BASE_URL}/products?category=${params.category}`;

      return {
        title,
        description,
        alternates: { canonical: canonicalUrl },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          type: "website",
          siteName: "Janička",
          locale: "cs_CZ",
        },
      };
    }
  }

  return {
    title: "Katalog",
    description:
      "Prohlédněte si naši kolekci stylového oblečení pro moderní ženy. Unikátní second hand kousky za zlomek ceny.",
    alternates: { canonical: `${BASE_URL}/products` },
    openGraph: {
      title: "Katalog",
      description:
        "Prohlédněte si naši kolekci stylového oblečení pro moderní ženy. Unikátní second hand kousky za zlomek ceny.",
      url: `${BASE_URL}/products`,
      type: "website",
      siteName: "Janička",
      locale: "cs_CZ",
    },
  };
}

/* ---------- Cached facet data (same for ALL users, biggest query) ---------- */
async function getCachedFacetData() {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const db = await getDb();
  const [categories, countingProducts] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.product.findMany({
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
      take: 2000,
    }),
  ]);
  return { categories, countingProducts };
}

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
  view?: string;
}

/** Safely parse a JSON string array, returning [] on failure. */
function parseJsonArray(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

/**
 * Compute faceted filter counts + total filtered count from cached products.
 * Each facet count excludes its own filter. totalFiltered applies ALL filters.
 */
function computeFilterCounts(
  products: {
    brand: string | null;
    sizes: string;
    colors: string;
    condition: string;
    price: number;
    compareAt: number | null;
    category: { slug: string };
  }[],
  filters: {
    category?: string;
    sale?: string;
    brands: string[];
    sizes: string[];
    conditions: string[];
    colors: string[];
    minPrice: number | null;
    maxPrice: number | null;
  },
) {
  const brandCounts: Record<string, number> = {};
  const sizeCounts: Record<string, number> = {};
  const conditionCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  let totalFiltered = 0;

  for (const p of products) {
    // Base filters (sale, price) — always applied to all facets
    if (filters.sale === "true" && !p.compareAt) continue;
    if (filters.minPrice !== null && p.price < filters.minPrice) continue;
    if (filters.maxPrice !== null && p.price > filters.maxPrice) continue;

    const pSizes = parseJsonArray(p.sizes);
    const pColors = parseJsonArray(p.colors);

    const matchesBrand =
      filters.brands.length === 0 ||
      (!!p.brand && filters.brands.includes(p.brand));
    const matchesSize =
      filters.sizes.length === 0 ||
      filters.sizes.some((s) => pSizes.includes(s));
    const matchesCond =
      filters.conditions.length === 0 ||
      filters.conditions.includes(p.condition);
    const matchesColor =
      filters.colors.length === 0 ||
      filters.colors.some((c) => pColors.includes(c));
    const matchesCategory =
      !filters.category || p.category.slug === filters.category;

    // Category counts: all filters EXCEPT category (faceted)
    if (matchesBrand && matchesSize && matchesCond && matchesColor) {
      categoryCounts[p.category.slug] =
        (categoryCounts[p.category.slug] ?? 0) + 1;
    }

    // Skip products not matching category for all other facets
    if (!matchesCategory) continue;

    // Total count: all filters applied
    if (matchesBrand && matchesSize && matchesCond && matchesColor) {
      totalFiltered++;
    }

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
      conditionCounts[p.condition] =
        (conditionCounts[p.condition] ?? 0) + 1;
    }
    // Color counts: all filters EXCEPT color
    if (matchesBrand && matchesSize && matchesCond) {
      for (const c of pColors)
        if (c) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
  }

  return {
    brands: brandCounts,
    sizes: sizeCounts,
    conditions: conditionCounts,
    colors: colorCounts,
    categories: categoryCounts,
    totalFiltered,
  };
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

/** Skeleton shown while ProductGrid streams in */
function ProductGridSkeleton({ view }: { view?: string }) {
  if (view === "list") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-2xl border p-4">
            <Skeleton className="aspect-[3/4] w-28 shrink-0 rounded-xl sm:w-36" />
            <div className="flex-1 space-y-3 py-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`grid gap-x-4 gap-y-8 ${view === "grid-2" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[3/4] w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      ))}
    </div>
  );
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
  const minPrice =
    rawMinPrice !== null && !isNaN(rawMinPrice)
      ? Math.max(0, Math.min(999999, rawMinPrice))
      : null;
  const maxPrice =
    rawMaxPrice !== null && !isNaN(rawMaxPrice)
      ? Math.max(0, Math.min(999999, rawMaxPrice))
      : null;

  // Facet data is cached for 30s — same for all users, avoids re-querying 2000 products per request
  // Wrapped in try-catch: "use cache" context uses a different CWD on local dev,
  // causing SQLite to fail. Falls back to empty arrays — ProductGrid still queries live.
  let facetData: Awaited<ReturnType<typeof getCachedFacetData>>;
  try {
    facetData = await getCachedFacetData();
  } catch {
    facetData = { categories: [], countingProducts: [] };
  }
  const { categories, countingProducts } = facetData;

  // Extract unique brands (sorted alphabetically)
  const brandSet = new Set<string>();
  const sizeSet = new Set<string>();
  const colorSet = new Set<string>();
  for (const p of countingProducts) {
    if (p.brand) brandSet.add(p.brand);
    for (const s of parseJsonArray(p.sizes)) if (s) sizeSet.add(s);
    for (const c of parseJsonArray(p.colors)) if (c) colorSet.add(c);
  }
  const brands = Array.from(brandSet).sort((a, b) =>
    a.localeCompare(b, "cs"),
  );
  const sizes = Array.from(sizeSet).sort((a, b) => {
    const ia = ALL_SIZES.indexOf(a as (typeof ALL_SIZES)[number]);
    const ib = ALL_SIZES.indexOf(b as (typeof ALL_SIZES)[number]);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b, "cs");
  });
  const colors = Array.from(colorSet).sort((a, b) =>
    a.localeCompare(b, "cs"),
  );

  // Compute faceted filter counts + total from cached data (instant)
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

  // Scope facet options to the current category — only show brands/sizes/colors that
  // actually exist in the filtered result set. Keep active filter values visible even
  // if their count drops to zero (e.g. user already selected something).
  const scopedBrands = brands.filter(
    (b) => (filterCounts.brands[b] ?? 0) > 0 || brandFilter.includes(b),
  );
  // Drop sizes that don't belong to the active category (defends against
  // legacy/garbage values on imported products — e.g. kid sizes "4 roky"
  // leaking onto Bundy & Kabáty). When no category is active, any canonical
  // enum size is allowed.
  const categoryAllowedSizes = params.category
    ? new Set(getSizesForCategory(params.category))
    : null;
  const scopedSizes = sizes.filter((s) => {
    if (categoryAllowedSizes && !categoryAllowedSizes.has(s)) return false;
    return (filterCounts.sizes[s] ?? 0) > 0 || sizeFilter.includes(s);
  });
  const scopedColors = colors.filter(
    (c) => (filterCounts.colors[c] ?? 0) > 0 || colorFilter.includes(c),
  );

  const totalItems = filterCounts.totalFiltered;
  const totalPages = Math.max(1, Math.ceil(totalItems / PRODUCTS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const activeCategory = params.category
    ? categories.find((c) => c.slug === params.category) ?? null
    : null;
  const categoryName = activeCategory?.name ?? "Všechny produkty";

  // Breadcrumb JSON-LD (only needs category info — no DB query needed)
  const breadcrumbItems = [{ name: "Katalog", url: "/products" }];
  if (params.category) {
    breadcrumbItems.push({
      name: categoryName,
      url: `/products?category=${params.category}`,
    });
  }
  const breadcrumbJsonLd = buildBreadcrumbSchema(breadcrumbItems);

  // Key that changes on any searchParam change → forces Suspense to remount and show skeleton
  const gridKey = JSON.stringify(params);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }}
      />

      {/* ===== Hero Banner — category-specific mood or generic catalog ===== */}
      {activeCategory ? (
        <CategoryHero
          name={activeCategory.name}
          slug={activeCategory.slug}
          description={activeCategory.description}
          image={activeCategory.image}
          productCount={totalItems}
        />
      ) : (
        <CatalogHero productCount={totalItems} />
      )}

      {/* Breadcrumb */}
      <nav
        className="mb-4 text-sm text-muted-foreground"
        aria-label="Navigace"
      >
        <Link href="/" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center hover:text-foreground">
          Domů
        </Link>
        <span className="mx-2">/</span>
        {params.category ? (
          <>
            <Link href="/products" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center hover:text-foreground">
              Katalog
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{categoryName}</span>
          </>
        ) : (
          <span className="text-foreground">Katalog</span>
        )}
      </nav>

      {/* ===== Sticky filter toolbar ===== */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="shrink-0 text-sm text-muted-foreground">
              {totalItems}{" "}
              {totalItems === 1
                ? "produkt"
                : totalItems >= 2 && totalItems <= 4
                  ? "produkty"
                  : "produktů"}
              {totalPages > 1 && (
                <span className="hidden sm:inline">
                  {" "}
                  &middot; stránka {safePage} z {totalPages}
                </span>
              )}
            </p>
            <div className="hidden min-w-0 flex-1 lg:block">
              <Suspense fallback={null}>
                <StickyCategoryNav
                  categories={categories.map((c) => ({
                    slug: c.slug,
                    name: c.name,
                  }))}
                  categoryCounts={filterCounts.categories}
                />
              </Suspense>
            </div>
          </div>
          <Suspense fallback={null}>
            <GridViewSwitcher />
          </Suspense>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4">
        <Suspense fallback={null}>
          <ProductFilters
            brands={scopedBrands}
            sizes={scopedSizes}
            colors={scopedColors}
            categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
            counts={filterCounts}
            categoryCounts={filterCounts.categories}
            totalFiltered={totalItems}
          />
        </Suspense>
      </div>

      {/* Product grid — streams in with skeleton fallback on any param change */}
      <div className="mt-8">
        <Suspense key={gridKey} fallback={<ProductGridSkeleton view={params.view} />}>
          <ProductGrid searchParams={params} categoryName={categoryName} />
        </Suspense>
      </div>

      {/* Pagination — renders instantly from cached count */}
      <Suspense fallback={null}>
        <Pagination totalItems={totalItems} perPage={PRODUCTS_PER_PAGE} />
      </Suspense>
    </div>
  );
}
