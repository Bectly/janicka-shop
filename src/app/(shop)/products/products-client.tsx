"use client";

/**
 * Client-side catalog: filtering, sorting, and pagination happen entirely
 * in-memory. The server ships the full active/unsold product list once
 * (inside `"use cache"` with cacheTag('products')), then this component
 * owns all UI state.
 *
 * URL is kept in sync via `window.history.replaceState` — so sharing/back-
 * forward still works — but we never call `router.push`, which would
 * trigger a full RSC round-trip and the skeleton flash Janička complained
 * about.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { ProductFilters } from "@/components/shop/product-filters";
import { ProductCard } from "@/components/shop/product-card";
import { ProductListItem } from "@/components/shop/product-list-item";
import { Pagination } from "@/components/shop/pagination";
import { StickyCategoryNav } from "@/components/shop/sticky-category-nav";
import { GridViewSwitcher, type ViewMode } from "@/components/shop/grid-view-switcher";
import { buildItemListSchema, jsonLdString } from "@/lib/structured-data";
import { ALL_SIZES, getSizesForCategory } from "@/lib/sizes";
import { parseMeasurements, type ProductMeasurements } from "@/lib/images";

const PRODUCTS_PER_PAGE = 12;

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  sku: string;
  price: number;
  compareAt: number | null;
  images: string;
  sizes: string;
  colors: string;
  brand: string | null;
  condition: string;
  stock: number;
  featured: boolean;
  sold: boolean;
  createdAt: string; // ISO string
  categoryName: string;
  categorySlug: string;
  lowestPrice30d: number | null;
  wishlistCount: number;
  /** Stringified JSON: { chest?, waist?, hips?, length?, sleeve?, inseam?, shoulders? } in cm. */
  measurements: string;
}

/** Numeric ranges discovered in the live catalog — used to seed filter UI. */
export interface MeasurementRanges {
  chest?: { min: number; max: number };
  waist?: { min: number; max: number };
  length?: { min: number; max: number };
}

interface ProductsClientProps {
  products: CatalogProduct[];
  categories: { slug: string; name: string }[];
  initialParams: Record<string, string | string[] | undefined>;
  categoryName: string;
}

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

interface Filters {
  category: string;
  sort: string;
  sale: boolean;
  brands: string[];
  sizes: string[];
  conditions: string[];
  colors: string[];
  minPrice: number | null;
  maxPrice: number | null;
  chestMin: number | null;
  chestMax: number | null;
  waistMin: number | null;
  waistMax: number | null;
  lengthMin: number | null;
  lengthMax: number | null;
  page: number;
  view: ViewMode;
}

/** Bounded float parser for measurement ranges (cm). 0–500 covers all garments. */
function parseCm(v: string | string[] | undefined): number | null {
  if (typeof v !== "string" || v === "") return null;
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(500, n));
}

function filtersFromParams(
  params: Record<string, string | string[] | undefined>,
): Filters {
  const rawMin = typeof params.minPrice === "string" ? parseFloat(params.minPrice) : NaN;
  const rawMax = typeof params.maxPrice === "string" ? parseFloat(params.maxPrice) : NaN;
  const view =
    params.view === "grid-2" || params.view === "list" ? (params.view as ViewMode) : "grid-3";
  return {
    category: typeof params.category === "string" ? params.category : "",
    sort: typeof params.sort === "string" ? params.sort : "newest",
    sale: params.sale === "true",
    brands: toArray(params.brand),
    sizes: toArray(params.size),
    conditions: toArray(params.condition),
    colors: toArray(params.color),
    minPrice: Number.isFinite(rawMin) ? Math.max(0, Math.min(999999, rawMin)) : null,
    maxPrice: Number.isFinite(rawMax) ? Math.max(0, Math.min(999999, rawMax)) : null,
    chestMin: parseCm(params.chest_min),
    chestMax: parseCm(params.chest_max),
    waistMin: parseCm(params.waist_min),
    waistMax: parseCm(params.waist_max),
    lengthMin: parseCm(params.length_min),
    lengthMax: parseCm(params.length_max),
    page: Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1") || 1),
    view,
  };
}

function filtersToSearchString(f: Filters): string {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.sort && f.sort !== "newest") p.set("sort", f.sort);
  if (f.sale) p.set("sale", "true");
  for (const b of f.brands) p.append("brand", b);
  for (const s of f.sizes) p.append("size", s);
  for (const c of f.conditions) p.append("condition", c);
  for (const c of f.colors) p.append("color", c);
  if (f.minPrice !== null) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice !== null) p.set("maxPrice", String(f.maxPrice));
  if (f.chestMin !== null) p.set("chest_min", String(f.chestMin));
  if (f.chestMax !== null) p.set("chest_max", String(f.chestMax));
  if (f.waistMin !== null) p.set("waist_min", String(f.waistMin));
  if (f.waistMax !== null) p.set("waist_max", String(f.waistMax));
  if (f.lengthMin !== null) p.set("length_min", String(f.lengthMin));
  if (f.lengthMax !== null) p.set("length_max", String(f.lengthMax));
  if (f.page > 1) p.set("page", String(f.page));
  if (f.view && f.view !== "grid-3") p.set("view", f.view);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Compute faceted filter counts + filtered product list in one pass.
 * Mirrors the previous server-side logic (page.tsx:computeFilterCounts)
 * but runs on the full in-memory catalog.
 */
function computeState(products: CatalogProduct[], f: Filters) {
  const brandCounts: Record<string, number> = {};
  const sizeCounts: Record<string, number> = {};
  const conditionCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  const matchedForGrid: CatalogProduct[] = [];

  // Per-dimension active flags — recomputed once outside the loop.
  const chestActive = f.chestMin !== null || f.chestMax !== null;
  const waistActive = f.waistMin !== null || f.waistMax !== null;
  const lengthActive = f.lengthMin !== null || f.lengthMax !== null;

  for (const p of products) {
    // Base filters (sale, price) — applied to everything
    if (f.sale && !p.compareAt) continue;
    if (f.minPrice !== null && p.price < f.minPrice) continue;
    if (f.maxPrice !== null && p.price > f.maxPrice) continue;

    // Measurement filters — additive: a product without a given measurement
    // value is never excluded, only narrowed when its value falls outside the
    // range. This keeps inventory without measurement data discoverable while
    // letting buyers who care surface matching pieces.
    if (chestActive || waistActive || lengthActive) {
      const m = parseMeasurements(p.measurements);
      if (chestActive && typeof m.chest === "number") {
        if (f.chestMin !== null && m.chest < f.chestMin) continue;
        if (f.chestMax !== null && m.chest > f.chestMax) continue;
      }
      if (waistActive && typeof m.waist === "number") {
        if (f.waistMin !== null && m.waist < f.waistMin) continue;
        if (f.waistMax !== null && m.waist > f.waistMax) continue;
      }
      if (lengthActive && typeof m.length === "number") {
        if (f.lengthMin !== null && m.length < f.lengthMin) continue;
        if (f.lengthMax !== null && m.length > f.lengthMax) continue;
      }
    }

    const pSizes = parseJsonArray(p.sizes);
    const pColors = parseJsonArray(p.colors);

    const matchesBrand =
      f.brands.length === 0 || (!!p.brand && f.brands.includes(p.brand));
    const matchesSize =
      f.sizes.length === 0 || f.sizes.some((s) => pSizes.includes(s));
    const matchesCond =
      f.conditions.length === 0 || f.conditions.includes(p.condition);
    const matchesColor =
      f.colors.length === 0 || f.colors.some((c) => pColors.includes(c));
    const matchesCategory = !f.category || p.categorySlug === f.category;

    // Category counts: all filters EXCEPT category
    if (matchesBrand && matchesSize && matchesCond && matchesColor) {
      categoryCounts[p.categorySlug] = (categoryCounts[p.categorySlug] ?? 0) + 1;
    }

    if (!matchesCategory) continue;

    if (matchesBrand && matchesSize && matchesCond && matchesColor) {
      matchedForGrid.push(p);
    }

    if (matchesSize && matchesCond && matchesColor && p.brand) {
      brandCounts[p.brand] = (brandCounts[p.brand] ?? 0) + 1;
    }
    if (matchesBrand && matchesCond && matchesColor) {
      for (const s of pSizes) if (s) sizeCounts[s] = (sizeCounts[s] ?? 0) + 1;
    }
    if (matchesBrand && matchesSize && matchesColor) {
      conditionCounts[p.condition] = (conditionCounts[p.condition] ?? 0) + 1;
    }
    if (matchesBrand && matchesSize && matchesCond) {
      for (const c of pColors) if (c) colorCounts[c] = (colorCounts[c] ?? 0) + 1;
    }
  }

  // Sort
  let sorted = matchedForGrid;
  if (f.sort === "price-asc") {
    sorted = [...matchedForGrid].sort((a, b) => a.price - b.price);
  } else if (f.sort === "price-desc") {
    sorted = [...matchedForGrid].sort((a, b) => b.price - a.price);
  } else if (f.sort === "discount") {
    sorted = [...matchedForGrid].sort((a, b) => {
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
  } else {
    // newest (default)
    sorted = [...matchedForGrid].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  return {
    brands: brandCounts,
    sizes: sizeCounts,
    conditions: conditionCounts,
    colors: colorCounts,
    categories: categoryCounts,
    totalFiltered: sorted.length,
    filteredProducts: sorted,
  };
}

const VIEW_GRID_CLASSES: Record<ViewMode, string> = {
  "grid-2": "grid grid-cols-2 gap-4 sm:gap-5 lg:gap-6",
  "grid-3": "grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6",
  list: "flex flex-col gap-3",
};

export function ProductsClient({
  products,
  categories,
  initialParams,
  categoryName,
}: ProductsClientProps) {
  const [filters, setFilters] = useState<Filters>(() => filtersFromParams(initialParams));
  const [, startTransition] = useTransition();
  const searchParams = useSearchParams();

  // Keep URL in sync WITHOUT triggering a server fetch (history.replaceState
  // does not invoke the Next.js router).
  const lastWrittenQs = useRef<string>(filtersToSearchString(filters));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = filtersToSearchString(filters);
    lastWrittenQs.current = qs;
    const target = `/products${qs}`;
    if (window.location.pathname + window.location.search !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [filters]);

  // Sync filters FROM the URL when Next.js router navigates (e.g. header
  // category link). `useState` initializer only runs once, so without this
  // effect, clicking /products?category=saty from within /products would
  // update the URL but leave the in-memory filter state stale → grid shows
  // all products regardless of selected category.
  // We intentionally only react to Next router changes (searchParams), not
  // to our own history.replaceState writes (which don't update the hook).
  const spString = searchParams.toString();
  useEffect(() => {
    const incomingQs = spString ? `?${spString}` : "";
    if (incomingQs === lastWrittenQs.current) return;
    const obj: Record<string, string | string[]> = {};
    for (const key of searchParams.keys()) {
      const all = searchParams.getAll(key);
      obj[key] = all.length > 1 ? all : all[0];
    }
    setFilters(filtersFromParams(obj));
  }, [spString, searchParams]);

  // Listen for back/forward: re-parse URL into state.
  useEffect(() => {
    function onPop() {
      const sp = new URLSearchParams(window.location.search);
      const obj: Record<string, string | string[]> = {};
      for (const key of sp.keys()) {
        const all = sp.getAll(key);
        obj[key] = all.length > 1 ? all : all[0];
      }
      setFilters(filtersFromParams(obj));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const state = useMemo(() => computeState(products, filters), [products, filters]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(state.totalFiltered / PRODUCTS_PER_PAGE));
  const safePage = Math.min(filters.page, totalPages);
  const startIndex = (safePage - 1) * PRODUCTS_PER_PAGE;
  const pageProducts = state.filteredProducts.slice(
    startIndex,
    startIndex + PRODUCTS_PER_PAGE,
  );

  // Build facet-scoped option lists (same logic as previous server page)
  const brandSet = new Set<string>();
  const sizeSet = new Set<string>();
  const colorSet = new Set<string>();
  for (const p of products) {
    if (p.brand) brandSet.add(p.brand);
    for (const s of parseJsonArray(p.sizes)) if (s) sizeSet.add(s);
    for (const c of parseJsonArray(p.colors)) if (c) colorSet.add(c);
  }
  const allBrands = useMemo(
    () => Array.from(brandSet).sort((a, b) => a.localeCompare(b, "cs")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );
  const allSizes = useMemo(
    () =>
      Array.from(sizeSet).sort((a, b) => {
        const ia = ALL_SIZES.indexOf(a as (typeof ALL_SIZES)[number]);
        const ib = ALL_SIZES.indexOf(b as (typeof ALL_SIZES)[number]);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b, "cs");
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );
  const allColors = useMemo(
    () => Array.from(colorSet).sort((a, b) => a.localeCompare(b, "cs")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );

  const scopedBrands = allBrands.filter(
    (b) => (state.brands[b] ?? 0) > 0 || filters.brands.includes(b),
  );
  const categoryAllowedSizes = filters.category
    ? new Set(getSizesForCategory(filters.category))
    : null;
  const scopedSizes = allSizes.filter((s) => {
    if (categoryAllowedSizes && !categoryAllowedSizes.has(s)) return false;
    return (state.sizes[s] ?? 0) > 0 || filters.sizes.includes(s);
  });
  const scopedColors = allColors.filter(
    (c) => (state.colors[c] ?? 0) > 0 || filters.colors.includes(c),
  );

  // Discover live measurement ranges (chest/waist/length) from the catalog so
  // the filter UI can seed inputs with realistic min/max bounds instead of
  // hard-coded numbers. Only the dimensions actually present (>=1 product with
  // data) get exposed — no point offering a "length" filter if nothing has it.
  const measurementRanges: MeasurementRanges = useMemo(() => {
    const seed = (): { min: number; max: number } | undefined => undefined;
    const acc: { chest?: { min: number; max: number }; waist?: { min: number; max: number }; length?: { min: number; max: number } } = {
      chest: seed(),
      waist: seed(),
      length: seed(),
    };
    function bump(key: "chest" | "waist" | "length", v: number) {
      const cur = acc[key];
      if (!cur) acc[key] = { min: v, max: v };
      else {
        if (v < cur.min) cur.min = v;
        if (v > cur.max) cur.max = v;
      }
    }
    for (const p of products) {
      let m: ProductMeasurements;
      try {
        m = parseMeasurements(p.measurements);
      } catch {
        continue;
      }
      if (typeof m.chest === "number") bump("chest", m.chest);
      if (typeof m.waist === "number") bump("waist", m.waist);
      if (typeof m.length === "number") bump("length", m.length);
    }
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // --- Mutation helpers ---

  function update(partial: Partial<Filters>) {
    startTransition(() => {
      setFilters((prev) => {
        const next = { ...prev, ...partial };
        // Any filter change (other than page itself) resets to page 1
        if (!("page" in partial)) next.page = 1;
        return next;
      });
    });
  }

  function clearAll() {
    startTransition(() => {
      setFilters({
        category: "",
        sort: "newest",
        sale: false,
        brands: [],
        sizes: [],
        conditions: [],
        colors: [],
        minPrice: null,
        maxPrice: null,
        chestMin: null,
        chestMax: null,
        waistMin: null,
        waistMax: null,
        lengthMin: null,
        lengthMax: null,
        page: 1,
        view: filters.view,
      });
    });
  }

  // ItemList JSON-LD for current page (keeps SEO parity with the previous server impl).
  const itemListJsonLd = useMemo(
    () =>
      buildItemListSchema(
        pageProducts.map((p) => ({
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
          categoryName: p.categoryName,
          colors: p.colors,
          sizes: p.sizes,
        })),
        categoryName,
        `/products${filters.category ? `?category=${filters.category}` : ""}`,
      ),
    [pageProducts, categoryName, filters.category],
  );

  const isListView = filters.view === "list";

  return (
    <>
      {/* Sticky filter toolbar */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="shrink-0 text-sm text-muted-foreground">
              {state.totalFiltered}{" "}
              {state.totalFiltered === 1
                ? "produkt"
                : state.totalFiltered >= 2 && state.totalFiltered <= 4
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
              <StickyCategoryNav
                categories={categories}
                categoryCounts={state.categories}
                activeCategory={filters.category}
                onChange={(slug) => update({ category: slug ?? "" })}
              />
            </div>
          </div>
          <GridViewSwitcher
            currentView={filters.view}
            onChange={(view) => update({ view })}
          />
        </div>
      </div>

      {/* Filters + Grid — sidebar layout on desktop, stacked on mobile */}
      <div className="mt-4 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:items-start">
        <ProductFilters
          brands={scopedBrands}
          sizes={scopedSizes}
          colors={scopedColors}
          categories={categories}
          counts={{
            brands: state.brands,
            sizes: state.sizes,
            conditions: state.conditions,
            colors: state.colors,
          }}
          categoryCounts={state.categories}
          totalFiltered={state.totalFiltered}
          filters={{
            category: filters.category,
            sort: filters.sort,
            sale: filters.sale,
            brands: filters.brands,
            sizes: filters.sizes,
            conditions: filters.conditions,
            colors: filters.colors,
            minPrice: filters.minPrice,
            maxPrice: filters.maxPrice,
            chestMin: filters.chestMin,
            chestMax: filters.chestMax,
            waistMin: filters.waistMin,
            waistMax: filters.waistMax,
            lengthMin: filters.lengthMin,
            lengthMax: filters.lengthMax,
          }}
          measurementRanges={measurementRanges}
          onChange={(patch) => update(patch)}
          onClearAll={clearAll}
        />

        {/* Grid */}
        <div className="mt-8 lg:mt-0 lg:min-w-0">
          {pageProducts.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-5 inline-flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 via-champagne-light/30 to-blush-light/40">
              <Search className="size-7 text-brand/50" aria-hidden="true" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Žádné výsledky
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
              Žádné kousky neodpovídají zvoleným filtrům. Zkus je upravit — nové přibývají každý den.
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <X className="size-3.5" aria-hidden="true" />
              Vymazat filtry
            </button>
          </div>
        ) : (
          <>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
            />
            <div className={VIEW_GRID_CLASSES[filters.view]}>
              {pageProducts.map((product, i) => {
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
                        categoryName={product.categoryName}
                        brand={product.brand}
                        condition={product.condition}
                        sizes={product.sizes}
                        colors={product.colors}
                        stock={product.stock}
                        createdAt={product.createdAt}
                        isReserved={false}
                        lowestPrice30d={product.lowestPrice30d}
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
                      categoryName={product.categoryName}
                      brand={product.brand}
                      condition={product.condition}
                      sizes={product.sizes}
                      colors={product.colors}
                      stock={product.stock}
                      createdAt={product.createdAt}
                      isReserved={false}
                      lowestPrice30d={product.lowestPrice30d}
                      wishlistCount={product.wishlistCount}
                      priority={i < 4}
                      variant={isEditorial ? "featured" : "standard"}
                    />
                  </div>
                );
              })}
            </div>
          </>
          )}

          <Pagination
            totalItems={state.totalFiltered}
            perPage={PRODUCTS_PER_PAGE}
            currentPage={safePage}
            onPageChange={(p) => update({ page: p })}
          />
        </div>
      </div>
    </>
  );
}
