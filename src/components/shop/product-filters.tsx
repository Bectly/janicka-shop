"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { CONDITION_LABELS } from "@/lib/constants";

interface ProductFiltersProps {
  brands: string[];
  sizes: string[];
  categories: { slug: string; name: string }[];
}

export function ProductFilters({
  brands,
  sizes,
  categories,
}: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") ?? "";
  const activeSort = searchParams.get("sort") ?? "newest";
  const activeBrands = searchParams.getAll("brand");
  const activeSizes = searchParams.getAll("size");
  const activeConditions = searchParams.getAll("condition");
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const saleOnly = searchParams.get("sale") === "true";

  const updateParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset to page 1 when filters change
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
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0) +
    (saleOnly ? 1 : 0) +
    (activeCategory ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Sort + filter count header */}
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
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Řazení:</label>
          <div className="relative">
            <select
              value={activeSort}
              onChange={(e) => updateParams({ sort: e.target.value })}
              className="appearance-none rounded-lg border bg-background py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="newest">Nejnovější</option>
              <option value="price-asc">Cena: od nejnižší</option>
              <option value="price-desc">Cena: od nejvyšší</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kategorie">
        <button
          onClick={() => updateParams({ category: null })}
          aria-pressed={!activeCategory}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !activeCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Vše
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => updateParams({ category: cat.slug })}
            aria-pressed={activeCategory === cat.slug}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat.slug
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Filter groups */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand filter */}
        {brands.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Značka
            </legend>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtr podle značky">
              {brands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => toggleMulti("brand", brand, activeBrands)}
                  aria-pressed={activeBrands.includes(brand)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    activeBrands.includes(brand)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Size filter */}
        {sizes.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Velikost
            </legend>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtr podle velikosti">
              {sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => toggleMulti("size", size, activeSizes)}
                  aria-pressed={activeSizes.includes(size)}
                  className={`min-w-[2.5rem] rounded-lg px-2.5 py-1 text-center text-xs font-medium transition-colors ${
                    activeSizes.includes(size)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {/* Condition filter */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Stav
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(CONDITION_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() =>
                  toggleMulti("condition", key, activeConditions)
                }
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  activeConditions.includes(key)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cena (Kč)
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
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
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="number"
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
        </div>
      </div>

      {/* Sale toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateParams({ sale: saleOnly ? null : "true" })}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            saleOnly
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Pouze ve slevě
        </button>
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Aktivní filtry:</span>
          {activeCategory && (
            <FilterChip
              label={
                categories.find((c) => c.slug === activeCategory)?.name ??
                activeCategory
              }
              onRemove={() => updateParams({ category: null })}
            />
          )}
          {activeBrands.map((b) => (
            <FilterChip
              key={`brand-${b}`}
              label={b}
              onRemove={() => toggleMulti("brand", b, activeBrands)}
            />
          ))}
          {activeSizes.map((s) => (
            <FilterChip
              key={`size-${s}`}
              label={`Vel. ${s}`}
              onRemove={() => toggleMulti("size", s, activeSizes)}
            />
          ))}
          {activeConditions.map((c) => (
            <FilterChip
              key={`cond-${c}`}
              label={CONDITION_LABELS[c] ?? c}
              onRemove={() => toggleMulti("condition", c, activeConditions)}
            />
          ))}
          {minPrice && (
            <FilterChip
              label={`od ${minPrice} Kč`}
              onRemove={() => updateParams({ minPrice: null })}
            />
          )}
          {maxPrice && (
            <FilterChip
              label={`do ${maxPrice} Kč`}
              onRemove={() => updateParams({ maxPrice: null })}
            />
          )}
          {saleOnly && (
            <FilterChip
              label="Ve slevě"
              onRemove={() => updateParams({ sale: null })}
            />
          )}
          <button
            onClick={clearAll}
            className="text-xs font-medium text-destructive hover:underline"
          >
            Smazat vše
          </button>
        </div>
      )}
    </div>
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
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
      {label}
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
        aria-label={`Odebrat filtr ${label}`}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
