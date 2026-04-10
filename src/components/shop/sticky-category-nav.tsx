"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface StickyCategoryNavProps {
  categories: { slug: string; name: string }[];
}

export function StickyCategoryNav({ categories }: StickyCategoryNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category") ?? "";

  function setCategory(slug: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (slug) {
      params.set("category", slug);
    } else {
      params.delete("category");
    }
    router.push(`/products?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="flex gap-1.5 overflow-x-auto scrollbar-none"
      role="navigation"
      aria-label="Kategorie"
    >
      <button
        onClick={() => setCategory(null)}
        aria-current={!activeCategory ? "page" : undefined}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          !activeCategory
            ? "bg-primary text-primary-foreground"
            : "bg-muted/60 text-muted-foreground hover:bg-muted"
        }`}
      >
        Vše
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => setCategory(cat.slug)}
          aria-current={activeCategory === cat.slug ? "page" : undefined}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeCategory === cat.slug
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
