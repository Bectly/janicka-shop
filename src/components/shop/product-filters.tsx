"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { CONDITION_LABELS, CONDITION_COLORS, COLOR_MAP } from "@/lib/constants";
import {
  CLOTHING_LETTER_SIZES,
  SHOE_SIZES,
  BRA_SIZES,
} from "@/lib/sizes";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface FilterCounts {
  brands: Record<string, number>;
  sizes: Record<string, number>;
  conditions: Record<string, number>;
  colors: Record<string, number>;
}

interface ProductFiltersProps {
  brands: string[];
  sizes: string[];
  colors: string[];
  categories: { slug: string; name: string }[];
  counts: FilterCounts;
  categoryCounts?: Record<string, number>;
  totalFiltered: number;
}

/** Returns true if a hex color (e.g. "#FFFFFF") is perceptually light. */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Perceived brightness (ITU-R BT.601)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

/** Czech plural for "produkt" */
function productPlural(n: number): string {
  if (n === 1) return "produkt";
  if (n >= 2 && n <= 4) return "produkty";
  return "produktů";
}

/** Split a flat size list into logical groups for display. */
function groupSizes(sizes: string[]): { label: string; sizes: string[] }[] {
  const letterSet = new Set<string>(CLOTHING_LETTER_SIZES);
  const shoeSet = new Set<string>(SHOE_SIZES);
  const braSet = new Set<string>(BRA_SIZES);

  const letters = sizes.filter((s) => letterSet.has(s));
  const shoes = sizes.filter((s) => shoeSet.has(s) && !letterSet.has(s));
  const bras = sizes.filter((s) => braSet.has(s));
  const one = sizes.filter((s) => s === "Univerzální");
  const other = sizes.filter(
    (s) => !letterSet.has(s) && !shoeSet.has(s) && !braSet.has(s) && s !== "Univerzální",
  );

  return [
    { label: "Oblečení", sizes: letters },
    { label: "Boty", sizes: shoes },
    { label: "Podprsenky", sizes: bras },
    { label: "Univerzální", sizes: one },
    { label: "Ostatní", sizes: other },
  ].filter((g) => g.sizes.length > 0);
}

export function ProductFilters({
  brands,
  sizes,
  colors,
  categories,
  counts,
  categoryCounts,
  totalFiltered,
}: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllBrandsDrawer, setShowAllBrandsDrawer] = useState(false);

  const activeCategory = searchParams.get("category") ?? "";
  const activeSort = searchParams.get("sort") ?? "newest";
  const activeBrands = searchParams.getAll("brand");
  const activeSizes = searchParams.getAll("size");
  const activeConditions = searchParams.getAll("condition");
  const activeColors = searchParams.getAll("color");
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const saleOnly = searchParams.get("sale") === "true";

  const updateParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [key, value] of Object.entries(updates)) {
        params.delete(key);
        if (value === null || value === "") continue;
        if (Array.isArray(value)) {
          for (const v of value) params.append(key, v);
        } else {
          params.set(key, value);
        }
      }
      router.push(`/products?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const toggleMulti = useCallback(
    (key: string, value: string, current: string[]) => {
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      updateParams({ [key]: next.length > 0 ? next : null });
    },
    [updateParams],
  );

  const clearAll = useCallback(() => {
    router.push("/products");
  }, [router]);

  const activeFilterCount =
    activeBrands.length +
    activeSizes.length +
    activeConditions.length +
    activeColors.length +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (saleOnly ? 1 : 0) +
    (activeCategory ? 1 : 0);

  // --- Shared filter sections (used in both desktop inline and mobile drawer) ---

  const totalAllCategories = categoryCounts
    ? Object.values(categoryCounts).reduce((sum, n) => sum + n, 0)
    : undefined;

  const categoryPills = (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Kategorie">
      <button
        onClick={() => updateParams({ category: null })}
        aria-pressed={!activeCategory}
        className={`min-h-11 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          !activeCategory
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        Vše
        {totalAllCategories !== undefined && (
          <span className="ml-1 text-xs opacity-60">({totalAllCategories})</span>
        )}
      </button>
      {categories.map((cat) => {
        const count = categoryCounts?.[cat.slug];
        return (
          <button
            key={cat.slug}
            onClick={() => updateParams({ category: cat.slug })}
            aria-pressed={activeCategory === cat.slug}
            className={`min-h-11 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat.slug
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat.name}
            {count !== undefined && (
              <span className="ml-1 text-xs opacity-60">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );

  const BRANDS_VISIBLE = 20;
  // Sort brands by product count descending; always surface active brands
  const brandsSortedByCount = [...brands].sort((a, b) => (counts.brands[b] ?? 0) - (counts.brands[a] ?? 0));
  const visibleBrands = showAllBrands
    ? brandsSortedByCount
    : brandsSortedByCount.slice(0, BRANDS_VISIBLE).concat(
        activeBrands.filter((b) => !brandsSortedByCount.slice(0, BRANDS_VISIBLE).includes(b))
      );
  const visibleBrandsDrawer = showAllBrandsDrawer
    ? brandsSortedByCount
    : brandsSortedByCount.slice(0, BRANDS_VISIBLE).concat(
        activeBrands.filter((b) => !brandsSortedByCount.slice(0, BRANDS_VISIBLE).includes(b))
      );
  const hasMoreBrands = brands.length > BRANDS_VISIBLE;

  function renderBrandButton(brand: string, size: "sm" | "base") {
    const count = counts.brands[brand] ?? 0;
    const isActive = activeBrands.includes(brand);
    const isDisabled = count === 0 && !isActive;
    return (
      <button
        key={brand}
        onClick={() => !isDisabled && toggleMulti("brand", brand, activeBrands)}
        aria-pressed={isActive}
        aria-disabled={isDisabled}
        className={`min-h-11 inline-flex items-center rounded-lg px-3 ${size === "base" ? "py-1.5 text-sm" : "py-1 text-xs"} font-medium transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : isDisabled
              ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {brand}
        <span className="ml-1 opacity-60">({count})</span>
      </button>
    );
  }

  const brandFilter = brands.length > 0 && (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Značka
      </legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtr podle značky">
        {visibleBrands.map((brand) => renderBrandButton(brand, "sm"))}
      </div>
      {hasMoreBrands && (
        <button
          onClick={() => setShowAllBrands((v) => !v)}
          className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
        >
          {showAllBrands ? "Zobrazit méně" : `Zobrazit všechny (${brands.length})`}
        </button>
      )}
    </fieldset>
  );

  const sizeGroups = groupSizes(sizes);

  function renderSizeButton(size: string, density: "sm" | "base") {
    const count = counts.sizes[size] ?? 0;
    const isActive = activeSizes.includes(size);
    const isDisabled = count === 0 && !isActive;
    return (
      <button
        key={size}
        onClick={() => !isDisabled && toggleMulti("size", size, activeSizes)}
        aria-pressed={isActive}
        aria-disabled={isDisabled}
        className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg ${density === "base" ? "px-2.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs"} font-medium transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : isDisabled
              ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        {size}
        <span className="ml-0.5 opacity-60">({count})</span>
      </button>
    );
  }

  const sizeFilterSection = sizes.length > 0 && (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Velikost
      </legend>
      <div className="space-y-2">
        {sizeGroups.map((group) => (
          <div key={group.label}>
            {sizeGroups.length > 1 && (
              <div className="mb-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </div>
            )}
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={`Filtr podle velikosti — ${group.label}`}
            >
              {group.sizes.map((s) => renderSizeButton(s, "sm"))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );

  const colorFilterSection = colors.length > 0 && (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Barva
      </legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr podle barvy">
        {colors.map((color) => {
          const count = counts.colors[color] ?? 0;
          const isActive = activeColors.includes(color);
          const isDisabled = count === 0 && !isActive;
          const hex = COLOR_MAP[color] ?? "#9CA3AF";
          const isLight = isLightColor(hex);
          return (
            <button
              key={color}
              onClick={() => !isDisabled && toggleMulti("color", color, activeColors)}
              aria-pressed={isActive}
              aria-disabled={isDisabled}
              aria-label={`${color} (${count})`}
              title={`${color} (${count})`}
              className={`group relative flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 ring-2 ring-primary"
                  : isDisabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-muted/80"
              }`}
            >
              <span
                className={`inline-block size-5 shrink-0 rounded-full border ${isLight ? "border-gray-300" : "border-transparent"}`}
                style={{ backgroundColor: hex }}
              >
                {isActive && (
                  <Check className={`size-5 p-0.5 ${isLight ? "text-gray-700" : "text-white"}`} />
                )}
              </span>
              <span className={isDisabled ? "text-muted-foreground/40" : "text-muted-foreground"}>
                {color}
                <span className="ml-0.5 opacity-60">({count})</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const conditionFilterSection = (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Stav
      </legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtr podle stavu">
        {Object.entries(CONDITION_LABELS).map(([key, label]) => {
          const count = counts.conditions[key] ?? 0;
          const isActive = activeConditions.includes(key);
          const isDisabled = count === 0 && !isActive;
          return (
            <button
              key={key}
              onClick={() => !isDisabled && toggleMulti("condition", key, activeConditions)}
              aria-pressed={isActive}
              aria-disabled={isDisabled}
              className={`min-h-11 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDisabled
                    ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span
                className={`size-2 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10 ${(CONDITION_COLORS[key] ?? "").split(" ")[0]}`}
                aria-hidden="true"
              />
              {label}
              <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const priceFilterSection = (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Cena (Kč)
      </legend>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-minPrice" className="sr-only">Minimální cena</label>
        <input
          id="filter-minPrice"
          type="number"
          min="0"
          max="999999"
          placeholder="od"
          defaultValue={minPrice}
          onBlur={(e) => updateParams({ minPrice: e.target.value || null })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              updateParams({ minPrice: e.currentTarget.value || null });
            }
          }}
          className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <span className="text-xs text-muted-foreground" aria-hidden="true">–</span>
        <label htmlFor="filter-maxPrice" className="sr-only">Maximální cena</label>
        <input
          id="filter-maxPrice"
          type="number"
          min="0"
          max="999999"
          placeholder="do"
          defaultValue={maxPrice}
          onBlur={(e) => updateParams({ maxPrice: e.target.value || null })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              updateParams({ maxPrice: e.currentTarget.value || null });
            }
          }}
          className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
    </fieldset>
  );

  const saleToggle = (
    <button
      onClick={() => updateParams({ sale: saleOnly ? null : "true" })}
      aria-pressed={saleOnly}
      className={`min-h-11 inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
        saleOnly
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      Pouze ve slevě
    </button>
  );

  const activeFilterChips = activeFilterCount > 0 && (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Aktivní filtry:</span>
      {activeCategory && (
        <FilterChip
          label={categories.find((c) => c.slug === activeCategory)?.name ?? activeCategory}
          onRemove={() => updateParams({ category: null })}
        />
      )}
      {activeBrands.map((b) => (
        <FilterChip key={`brand-${b}`} label={b} onRemove={() => toggleMulti("brand", b, activeBrands)} />
      ))}
      {activeSizes.map((s) => (
        <FilterChip key={`size-${s}`} label={`Vel. ${s}`} onRemove={() => toggleMulti("size", s, activeSizes)} />
      ))}
      {activeColors.map((c) => (
        <FilterChip key={`color-${c}`} label={c} onRemove={() => toggleMulti("color", c, activeColors)} />
      ))}
      {activeConditions.map((c) => (
        <FilterChip key={`cond-${c}`} label={CONDITION_LABELS[c] ?? c} onRemove={() => toggleMulti("condition", c, activeConditions)} />
      ))}
      {minPrice && <FilterChip label={`od ${minPrice} Kč`} onRemove={() => updateParams({ minPrice: null })} />}
      {maxPrice && <FilterChip label={`do ${maxPrice} Kč`} onRemove={() => updateParams({ maxPrice: null })} />}
      {saleOnly && <FilterChip label="Ve slevě" onRemove={() => updateParams({ sale: null })} />}
      <button onClick={clearAll} className="text-xs font-medium text-destructive hover:underline">
        Smazat vše
      </button>
    </div>
  );

  const sortDropdown = (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-select" className="text-xs text-muted-foreground">Řazení:</label>
      <div className="relative">
        <select
          id="sort-select"
          value={activeSort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="appearance-none rounded-lg border bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="newest">Nejnovější</option>
          <option value="price-asc">Cena: od nejnižší</option>
          <option value="price-desc">Cena: od nejvyšší</option>
          <option value="discount">Největší sleva</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );

  // --- Promoted quick filters (horizontally scrollable, above product grid) ---
  // Shows top sizes and colors as quick-access pills — reduces need to open filter drawer.
  // 61% of sites don't promote filters above the grid (Baymard).
  const topSizes = sizes.filter((s) => (counts.sizes[s] ?? 0) > 0).slice(0, 12);
  const topColors = colors.filter((c) => (counts.colors[c] ?? 0) > 0).slice(0, 10);
  const hasQuickFilters = topSizes.length > 0 || topColors.length > 0;

  const quickFilters = hasQuickFilters && (
    <div className="space-y-2">
      {/* Size quick pills */}
      {topSizes.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Velikost:</span>
          <div className="min-w-0 flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5" role="group" aria-label="Rychlý filtr velikostí">
            {topSizes.map((size) => {
              const isActive = activeSizes.includes(size);
              return (
                <button
                  key={size}
                  onClick={() => toggleMulti("size", size, activeSizes)}
                  aria-pressed={isActive}
                  className={`shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* Color quick swatches */}
      {topColors.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Barva:</span>
          <div className="min-w-0 flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5" role="group" aria-label="Rychlý filtr barev">
            {topColors.map((color) => {
              const isActive = activeColors.includes(color);
              const hex = COLOR_MAP[color] ?? "#9CA3AF";
              const isLight = isLightColor(hex);
              return (
                <button
                  key={color}
                  onClick={() => toggleMulti("color", color, activeColors)}
                  aria-pressed={isActive}
                  aria-label={color}
                  title={color}
                  className={`group flex shrink-0 min-h-11 items-center gap-1 rounded-full py-1 pl-1.5 pr-2.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <span
                    className={`inline-block size-4 rounded-full border ${isLight ? "border-gray-300" : "border-transparent"}`}
                    style={{ backgroundColor: hex }}
                  >
                    {isActive && (
                      <Check className={`size-4 p-0.5 ${isLight ? "text-gray-700" : "text-white"}`} />
                    )}
                  </span>
                  <span className="text-muted-foreground">{color}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const filterGroups = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {brandFilter}
      {sizeFilterSection}
      {colorFilterSection}
      {conditionFilterSection}
      {priceFilterSection}
    </div>
  );

  return (
    <>
      {/* ===== DESKTOP: inline filters (hidden on mobile) ===== */}
      <div className="hidden lg:block space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filtry</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </div>
          {sortDropdown}
        </div>
        {categoryPills}
        {filterGroups}
        <div className="flex items-center gap-2">{saleToggle}</div>
        {activeFilterChips}
      </div>

      {/* ===== MOBILE: compact bar + drawer (hidden on desktop) ===== */}
      <div className="lg:hidden space-y-4">
        {/* Top bar: sort dropdown + inline filter count */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {totalFiltered} {productPlural(totalFiltered)}
            </span>
          </div>
          {sortDropdown}
        </div>

        {/* Category pills (always visible on mobile) */}
        {categoryPills}

        {/* Promoted quick filters — size pills + color swatches (reduces drawer round-trips) */}
        {quickFilters}

        {/* Active filter chips (visible after closing drawer) */}
        {activeFilterChips}

        {/* Mobile filter drawer — full-screen with accordion sections */}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="!max-h-[100dvh] !h-[100dvh] !rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <DrawerHeader className="flex-row items-center justify-between border-b pb-3">
              <DrawerTitle>Filtry</DrawerTitle>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                aria-label="Zavřít filtry"
              >
                <X className="size-5" />
              </button>
            </DrawerHeader>

            {/* Scrollable accordion filter sections — research-backed order: Size → Price → Color → Brand → Condition → Sale */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              <Accordion defaultValue={[0]} multiple>
                {sizes.length > 0 && (
                  <AccordionItem value={0}>
                    <AccordionTrigger className="text-sm font-semibold">
                      Velikost
                      {activeSizes.length > 0 && (
                        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          {activeSizes.length}
                        </span>
                      )}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pb-2">
                        {sizeGroups.map((group) => (
                          <div key={group.label}>
                            {sizeGroups.length > 1 && (
                              <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                                {group.label}
                              </div>
                            )}
                            <div
                              className="flex flex-wrap gap-1.5"
                              role="group"
                              aria-label={`Filtr podle velikosti — ${group.label}`}
                            >
                              {group.sizes.map((s) => renderSizeButton(s, "base"))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value={1}>
                  <AccordionTrigger className="text-sm font-semibold">
                    Cena
                    {(minPrice || maxPrice) && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">1</span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center gap-2 pb-2">
                      <label htmlFor="drawer-minPrice" className="sr-only">Minimální cena</label>
                      <input
                        id="drawer-minPrice"
                        type="number"
                        min="0"
                        max="999999"
                        inputMode="numeric"
                        placeholder="od"
                        defaultValue={minPrice}
                        onBlur={(e) => updateParams({ minPrice: e.target.value || null })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            updateParams({ minPrice: e.currentTarget.value || null });
                          }
                        }}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <span className="text-sm text-muted-foreground" aria-hidden="true">–</span>
                      <label htmlFor="drawer-maxPrice" className="sr-only">Maximální cena</label>
                      <input
                        id="drawer-maxPrice"
                        type="number"
                        min="0"
                        max="999999"
                        inputMode="numeric"
                        placeholder="do"
                        defaultValue={maxPrice}
                        onBlur={(e) => updateParams({ maxPrice: e.target.value || null })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            updateParams({ maxPrice: e.currentTarget.value || null });
                          }
                        }}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <span className="text-sm text-muted-foreground">Kč</span>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {colors.length > 0 && (
                  <AccordionItem value={2}>
                    <AccordionTrigger className="text-sm font-semibold">
                      Barva
                      {activeColors.length > 0 && (
                        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          {activeColors.length}
                        </span>
                      )}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap gap-2 pb-2" role="group" aria-label="Filtr podle barvy">
                        {colors.map((color) => {
                          const count = counts.colors[color] ?? 0;
                          const isActive = activeColors.includes(color);
                          const isDisabled = count === 0 && !isActive;
                          const hex = COLOR_MAP[color] ?? "#9CA3AF";
                          const isLight = isLightColor(hex);
                          return (
                            <button
                              key={color}
                              onClick={() => !isDisabled && toggleMulti("color", color, activeColors)}
                              aria-pressed={isActive}
                              aria-disabled={isDisabled}
                              aria-label={`${color} (${count})`}
                              title={`${color} (${count})`}
                              className={`group relative flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                                isActive
                                  ? "bg-primary/10 ring-2 ring-primary"
                                  : isDisabled
                                    ? "opacity-40 cursor-not-allowed"
                                    : "hover:bg-muted/80"
                              }`}
                            >
                              <span
                                className={`inline-block size-5 shrink-0 rounded-full border ${isLight ? "border-gray-300" : "border-transparent"}`}
                                style={{ backgroundColor: hex }}
                              >
                                {isActive && (
                                  <Check className={`size-5 p-0.5 ${isLight ? "text-gray-700" : "text-white"}`} />
                                )}
                              </span>
                              <span className={isDisabled ? "text-muted-foreground/40" : "text-muted-foreground"}>
                                {color}
                                <span className="ml-0.5 opacity-60">({count})</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {brands.length > 0 && (
                  <AccordionItem value={3}>
                    <AccordionTrigger className="text-sm font-semibold">
                      Značka
                      {activeBrands.length > 0 && (
                        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                          {activeBrands.length}
                        </span>
                      )}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap gap-1.5 pb-2" role="group" aria-label="Filtr podle značky">
                        {visibleBrandsDrawer.map((brand) => renderBrandButton(brand, "base"))}
                      </div>
                      {hasMoreBrands && (
                        <button
                          onClick={() => setShowAllBrandsDrawer((v) => !v)}
                          className="mt-1 mb-2 text-sm text-primary underline-offset-2 hover:underline"
                        >
                          {showAllBrandsDrawer ? "Zobrazit méně" : `Zobrazit všechny (${brands.length})`}
                        </button>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                <AccordionItem value={4}>
                  <AccordionTrigger className="text-sm font-semibold">
                    Stav
                    {activeConditions.length > 0 && (
                      <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        {activeConditions.length}
                      </span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-1.5 pb-2" role="group" aria-label="Filtr podle stavu">
                      {Object.entries(CONDITION_LABELS).map(([key, label]) => {
                        const count = counts.conditions[key] ?? 0;
                        const isActive = activeConditions.includes(key);
                        const isDisabled = count === 0 && !isActive;
                        return (
                          <button
                            key={key}
                            onClick={() => !isDisabled && toggleMulti("condition", key, activeConditions)}
                            aria-pressed={isActive}
                            aria-disabled={isDisabled}
                            className={`min-h-11 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : isDisabled
                                  ? "bg-muted/50 text-muted-foreground/40 cursor-not-allowed"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            <span
                              className={`size-2 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10 ${(CONDITION_COLORS[key] ?? "").split(" ")[0]}`}
                              aria-hidden="true"
                            />
                            {label}
                            <span className="opacity-60">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value={5}>
                  <AccordionTrigger className="text-sm font-semibold">
                    Sleva
                    {saleOnly && (
                      <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">1</span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center gap-2 pb-2">
                      <button
                        onClick={() => updateParams({ sale: saleOnly ? null : "true" })}
                        aria-pressed={saleOnly}
                        className={`min-h-11 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                          saleOnly
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        Pouze ve slevě
                      </button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Sticky footer with product count + clear all */}
            <DrawerFooter className="border-t pt-3 pb-[env(safe-area-inset-bottom)]">
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                style={{ minHeight: "56px" }}
              >
                Zobrazit {totalFiltered} {productPlural(totalFiltered)}
              </button>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    clearAll();
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2 text-sm font-medium text-destructive hover:underline"
                >
                  Smazat všechny filtry
                </button>
              )}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Sticky bottom filter button — positioned above the bottom nav bar (h-14 = 3.5rem) */}
        <div
          className="fixed left-1/2 z-30 -translate-x-1/2"
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border bg-background px-5 py-3 text-sm font-semibold text-foreground shadow-lg transition-colors hover:bg-muted active:scale-95"
          >
            <SlidersHorizontal className="size-4" />
            Filtry
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {label}
      <button
        onClick={onRemove}
        className="flex min-h-7 min-w-7 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
        aria-label={`Odebrat filtr ${label}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
