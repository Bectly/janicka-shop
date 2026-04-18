"use client";

interface StickyCategoryNavProps {
  categories: { slug: string; name: string }[];
  categoryCounts?: Record<string, number>;
  activeCategory: string;
  onChange: (slug: string | null) => void;
}

export function StickyCategoryNav({
  categories,
  categoryCounts,
  activeCategory,
  onChange,
}: StickyCategoryNavProps) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto scrollbar-none"
      role="navigation"
      aria-label="Kategorie"
    >
      <button
        onClick={() => onChange(null)}
        aria-current={!activeCategory ? "page" : undefined}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
          !activeCategory
            ? "bg-primary text-primary-foreground"
            : "bg-muted/60 text-muted-foreground hover:bg-muted"
        }`}
      >
        Vše
      </button>
      {categories.map((cat) => {
        const count = categoryCounts?.[cat.slug];
        return (
          <button
            key={cat.slug}
            onClick={() => onChange(cat.slug)}
            aria-current={activeCategory === cat.slug ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 ${
              activeCategory === cat.slug
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            {cat.name}
            {count !== undefined && count > 0 && (
              <span className="ml-0.5 opacity-50">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
