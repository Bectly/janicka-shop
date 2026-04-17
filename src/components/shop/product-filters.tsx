"use client";

import { useState, useCallback } from "react";
import { X, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONDITION_LABELS, CONDITION_COLORS, COLOR_MAP } from "@/lib/constants";
import {
  CLOTHING_LETTER_SIZES,
  SHOE_SIZES,
  BRA_SIZES,
  getSizeGroupsForCategory,
  getSizesForCategory,
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

/** Controlled filter state — owned by parent (ProductsClient). */
export interface ProductFiltersState {
  category: string;
  sort: string;
  sale: boolean;
  brands: string[];
  sizes: string[];
  conditions: string[];
  colors: string[];
  minPrice: number | null;
  maxPrice: number | null;
}

interface ProductFiltersProps {
  brands: string[];
  sizes: string[];
  colors: string[];
  categories: { slug: string; name: string }[];
  counts: FilterCounts;
  categoryCounts?: Record<string, number>;
  totalFiltered: number;
  filters: ProductFiltersState;
  onChange: (patch: Partial<ProductFiltersState>) => void;
  onClearAll: () => void;
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

/**
 * Split a flat size list into logical groups for display, constrained by
 * category. When a category is active, only size groups valid for that
 * category are shown (e.g. "Topy & halenky" never shows shoe sizes).
 * Each size is assigned to the first allowed group it belongs to, so
 * overlapping values like "38" (both clothing EU and shoe) are disambiguated
 * by category context.
 */
function groupSizes(
  sizes: string[],
  categorySlug: string,
): { label: string; sizes: string[] }[] {
  const allowedGroups = getSizeGroupsForCategory(categorySlug || null);
  const result: { label: string; sizes: string[] }[] = [];
  const assigned = new Set<string>();

  for (const g of allowedGroups) {
    const groupSet = new Set<string>(g.sizes);
    const matched = sizes.filter((s) => !assigned.has(s) && groupSet.has(s));
    for (const s of matched) assigned.add(s);
    if (matched.length > 0) result.push({ label: g.label, sizes: matched });
  }

  // Fallback bucket: only shown when NO category is selected — keeps any
  // unusual values (legacy imports, bra sizes on generic view) visible.
  if (!categorySlug) {
    const letterSet = new Set<string>(CLOTHING_LETTER_SIZES);
    const shoeSet = new Set<string>(SHOE_SIZES);
    const braSet = new Set<string>(BRA_SIZES);
    const leftover = sizes.filter(
      (s) =>
        !assigned.has(s) &&
        !letterSet.has(s) &&
        !shoeSet.has(s) &&
        !braSet.has(s) &&
        s !== "Univerzální",
    );
    if (leftover.length > 0) result.push({ label: "Ostatní", sizes: leftover });
  }

  return result;
}

export function ProductFilters({
  brands,
  sizes,
  colors,
  categories,
  counts,
  categoryCounts,
  totalFiltered,
  filters,
  onChange,
  onClearAll,
}: ProductFiltersProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [showAllBrandsDrawer, setShowAllBrandsDrawer] = useState(false);

  const activeCategory = filters.category;
  const activeSort = filters.sort;
  const activeBrands = filters.brands;
  const activeSizes = filters.sizes;
  const activeConditions = filters.conditions;
  const activeColors = filters.colors;
  const minPrice = filters.minPrice !== null ? String(filters.minPrice) : "";
  const maxPrice = filters.maxPrice !== null ? String(filters.maxPrice) : "";
  const saleOnly = filters.sale;

  /**
   * Adapter: the old codebase spoke in URL-param keys ("brand", "size", "sale",
   * "minPrice", "maxPrice", "category", "sort"). Translate that vocabulary into
   * the controlled-state shape `ProductFiltersState`.
   */
  const updateParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const patch: Partial<ProductFiltersState> = {};
      for (const [key, value] of Object.entries(updates)) {
        switch (key) {
          case "category":
            patch.category = typeof value === "string" ? value : "";
            break;
          case "sort":
            patch.sort = typeof value === "string" && value ? value : "newest";
            break;
          case "sale":
            patch.sale = value === "true";
            break;
          case "brand":
            patch.brands = Array.isArray(value) ? value : value ? [value] : [];
            break;
          case "size":
            patch.sizes = Array.isArray(value) ? value : value ? [value] : [];
            break;
          case "condition":
            patch.conditions = Array.isArray(value) ? value : value ? [value] : [];
            break;
          case "color":
            patch.colors = Array.isArray(value) ? value : value ? [value] : [];
            break;
          case "minPrice": {
            const n = typeof value === "string" && value ? parseFloat(value) : NaN;
            patch.minPrice = Number.isFinite(n) ? n : null;
            break;
          }
          case "maxPrice": {
            const n = typeof value === "string" && value ? parseFloat(value) : NaN;
            patch.maxPrice = Number.isFinite(n) ? n : null;
            break;
          }
        }
      }
      onChange(patch);
    },
    [onChange],
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
    onClearAll();
  }, [onClearAll]);

  const activeFilterCount =
    activeBrands.length +
    activeSizes.length +
    activeConditions.length +
    activeColors.length +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (saleOnly ? 1 : 0) +
    (activeCategory ? 1 : 0);

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


  // When a category is active, restrict visible sizes to those valid for it.
  // Prevents shoe sizes from showing on Topy/Halenky etc. (category-blind data
  // from Vinted imports can still leave orphan tags, which we silently drop).
  const categoryAllowedSizes = activeCategory
    ? new Set(getSizesForCategory(activeCategory))
    : null;
  const visibleSizes = categoryAllowedSizes
    ? sizes.filter((s) => categoryAllowedSizes.has(s) || activeSizes.includes(s))
    : sizes;
  const sizeGroups = groupSizes(visibleSizes, activeCategory);

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
      <Button variant="link" onClick={clearAll} className="h-auto p-0 text-xs text-destructive">
        Smazat vše
      </Button>
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
  const topSizes = visibleSizes.filter((s) => (counts.sizes[s] ?? 0) > 0).slice(0, 12);
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

  return (
    <>
      {/* ===== DESKTOP: sidebar accordion (hidden on mobile) ===== */}
      <aside className="hidden lg:block lg:sticky lg:top-24 lg:self-start space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filtry</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="link"
              onClick={clearAll}
              className="h-auto p-0 text-xs text-destructive"
            >
              Smazat vše
            </Button>
          )}
        </div>
        {sortDropdown}
        {activeFilterChips}
        <Accordion
          multiple
          defaultValue={["sizes", "colors"]}
          className="border-t border-border/50"
        >
          {visibleSizes.length > 0 && (
            <AccordionItem value="sizes">
              <AccordionTrigger className="py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Velikost
                {activeSizes.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {activeSizes.length}
                  </span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-1">
                  {sizeGroups.map((group) => {
                    const sizesWithStock = group.sizes.filter(
                      (s) => (counts.sizes[s] ?? 0) > 0 || activeSizes.includes(s),
                    );
                    if (sizesWithStock.length === 0) return null;
                    return (
                      <div key={group.label}>
                        {sizeGroups.length > 1 && (
                          <div className="mb-1 text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground/70">
                            {group.label}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Filtr podle velikosti — ${group.label}`}>
                          {sizesWithStock.map((s) => renderSizeButton(s, "sm"))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
          {colors.filter((c) => (counts.colors[c] ?? 0) > 0 || activeColors.includes(c)).length > 0 && (
            <AccordionItem value="colors">
              <AccordionTrigger className="py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Barva
                {activeColors.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {activeColors.length}
                  </span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2 pb-1" role="group" aria-label="Filtr podle barvy">
                  {colors
                    .filter((c) => (counts.colors[c] ?? 0) > 0 || activeColors.includes(c))
                    .map((color) => {
                      const count = counts.colors[color] ?? 0;
                      const isActive = activeColors.includes(color);
                      const hex = COLOR_MAP[color] ?? "#9CA3AF";
                      const isLight = isLightColor(hex);
                      return (
                        <button
                          key={color}
                          onClick={() => toggleMulti("color", color, activeColors)}
                          aria-pressed={isActive}
                          aria-label={`${color} (${count})`}
                          title={`${color} (${count})`}
                          className={`group relative flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-primary/10 ring-2 ring-primary"
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
                          <span className="text-muted-foreground">
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
          {brands.filter((b) => (counts.brands[b] ?? 0) > 0 || activeBrands.includes(b)).length > 0 && (
            <AccordionItem value="brands">
              <AccordionTrigger className="py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Značka
                {activeBrands.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {activeBrands.length}
                  </span>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1.5 pb-1" role="group" aria-label="Filtr podle značky">
                  {visibleBrands
                    .filter((b) => (counts.brands[b] ?? 0) > 0 || activeBrands.includes(b))
                    .map((brand) => renderBrandButton(brand, "sm"))}
                </div>
                {hasMoreBrands && (
                  <Button
                    variant="link"
                    onClick={() => setShowAllBrands((v) => !v)}
                    className="mt-2 h-auto p-0 text-xs"
                  >
                    {showAllBrands ? "Zobrazit méně" : `Zobrazit všechny (${brands.length})`}
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="conditions">
            <AccordionTrigger className="py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Stav
              {activeConditions.length > 0 && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {activeConditions.length}
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-1.5 pb-1" role="group" aria-label="Filtr podle stavu">
                {Object.entries(CONDITION_LABELS)
                  .filter(([key]) => (counts.conditions[key] ?? 0) > 0 || activeConditions.includes(key))
                  .map(([key, label]) => {
                    const count = counts.conditions[key] ?? 0;
                    const isActive = activeConditions.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleMulti("condition", key, activeConditions)}
                        aria-pressed={isActive}
                        className={`min-h-11 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
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
          <AccordionItem value="price">
            <AccordionTrigger className="py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cena (Kč)
              {(minPrice || maxPrice) && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">1</span>
              )}
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center gap-2 pb-1">
                <label htmlFor="filter-minPrice" className="sr-only">Minimální cena</label>
                <Input
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
                  className="h-8 text-xs"
                />
                <span className="text-xs text-muted-foreground" aria-hidden="true">–</span>
                <label htmlFor="filter-maxPrice" className="sr-only">Maximální cena</label>
                <Input
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
                  className="h-8 text-xs"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="sale">
            <AccordionTrigger className="py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sleva
              {saleOnly && (
                <span className="ml-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">1</span>
              )}
            </AccordionTrigger>
            <AccordionContent>
              <div className="pb-1">
                {saleToggle}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </aside>

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
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-full"
                aria-label="Zavřít filtry"
              >
                <X className="size-5" />
              </Button>
            </DrawerHeader>

            {/* Scrollable accordion filter sections — research-backed order: Size → Price → Color → Brand → Condition → Sale */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              <Accordion defaultValue={[0]} multiple>
                {visibleSizes.length > 0 && (
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
                      <Input
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
                      />
                      <span className="text-sm text-muted-foreground" aria-hidden="true">–</span>
                      <label htmlFor="drawer-maxPrice" className="sr-only">Maximální cena</label>
                      <Input
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
                        <Button
                          variant="link"
                          onClick={() => setShowAllBrandsDrawer((v) => !v)}
                          className="mt-1 mb-2 h-auto p-0 text-sm"
                        >
                          {showAllBrandsDrawer ? "Zobrazit méně" : `Zobrazit všechny (${brands.length})`}
                        </Button>
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
                      {Object.entries(CONDITION_LABELS)
                        .filter(([key]) => (counts.conditions[key] ?? 0) > 0 || activeConditions.includes(key))
                        .map(([key, label]) => {
                          const count = counts.conditions[key] ?? 0;
                          const isActive = activeConditions.includes(key);
                          return (
                            <button
                              key={key}
                              onClick={() => toggleMulti("condition", key, activeConditions)}
                              aria-pressed={isActive}
                              className={`min-h-11 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                isActive
                                  ? "bg-primary text-primary-foreground"
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
              <Button
                onClick={() => setIsDrawerOpen(false)}
                className="w-full min-h-14 rounded-xl py-3.5 text-sm font-semibold h-auto"
              >
                Zobrazit {totalFiltered} {productPlural(totalFiltered)}
              </Button>
              {activeFilterCount > 0 && (
                <Button
                  variant="link"
                  onClick={() => {
                    clearAll();
                    setIsDrawerOpen(false);
                  }}
                  className="w-full h-auto py-2 text-sm font-medium text-destructive"
                >
                  Smazat všechny filtry
                </Button>
              )}
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Sticky bottom filter button — positioned above the bottom nav bar (h-14 = 3.5rem) */}
        <div
          className="fixed left-1/2 z-30 -translate-x-1/2 bottom-[calc(3.5rem+env(safe-area-inset-bottom,_0px)+0.75rem)]"
        >
          <Button
            variant="outline"
            onClick={() => setIsDrawerOpen(true)}
            className="gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-lg active:scale-95 h-auto bg-background"
          >
            <SlidersHorizontal className="size-4" />
            Filtry
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </Button>
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
