import Link from "next/link";

interface CategoryCardProps {
  name: string;
  slug: string;
  description?: string | null;
  productCount: number;
}

const categoryIcons: Record<string, string> = {
  saty: "👗",
  "topy-halenky": "👚",
  "kalhoty-sukne": "👖",
  "bundy-kabaty": "🧥",
  doplnky: "👜",
};

const categoryThemes: Record<string, {
  cardFrom: string;
  iconBg: string;
  hoverBorder: string;
  hoverShadow: string;
}> = {
  saty: {
    cardFrom: "from-brand/[0.06]",
    iconBg: "bg-brand/10",
    hoverBorder: "hover:border-brand/35",
    hoverShadow: "hover:shadow-[0_8px_24px_-6px_oklch(0.55_0.20_350_/_0.14)]",
  },
  "topy-halenky": {
    cardFrom: "from-violet-50",
    iconBg: "bg-violet-100",
    hoverBorder: "hover:border-violet-200",
    hoverShadow: "hover:shadow-lg",
  },
  "kalhoty-sukne": {
    cardFrom: "from-sage-light/40",
    iconBg: "bg-sage-light",
    hoverBorder: "hover:border-sage/35",
    hoverShadow: "hover:shadow-[0_8px_24px_-6px_oklch(0.72_0.06_155_/_0.14)]",
  },
  "bundy-kabaty": {
    cardFrom: "from-champagne/30",
    iconBg: "bg-champagne",
    hoverBorder: "hover:border-champagne-dark/30",
    hoverShadow: "hover:shadow-lg",
  },
  doplnky: {
    cardFrom: "from-amber-50",
    iconBg: "bg-amber-100",
    hoverBorder: "hover:border-amber-200",
    hoverShadow: "hover:shadow-lg",
  },
};

const defaultTheme = {
  cardFrom: "from-primary/[0.04]",
  iconBg: "bg-primary/10",
  hoverBorder: "hover:border-primary/35",
  hoverShadow: "hover:shadow-[0_8px_24px_-6px_oklch(0.55_0.20_350_/_0.14)]",
};

export function CategoryCard({
  name,
  slug,
  description,
  productCount,
}: CategoryCardProps) {
  const t = categoryThemes[slug] ?? defaultTheme;
  return (
    <Link
      href={`/products?category=${slug}`}
      className={`group flex flex-col items-center gap-3 rounded-2xl border bg-card bg-gradient-to-br ${t.cardFrom} p-6 text-center transition-all duration-300 ${t.hoverBorder} ${t.hoverShadow} hover:-translate-y-0.5`}
    >
      <span
        className={`flex size-14 items-center justify-center rounded-2xl text-3xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${t.iconBg}`}
        role="img"
        aria-label={name}
      >
        {categoryIcons[slug] ?? "🏷️"}
      </span>
      <div>
        <h3 className="font-medium text-foreground transition-colors group-hover:text-primary">
          {name}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {productCount} {productCount === 1 ? "produkt" : productCount < 5 ? "produkty" : "produktů"}
        </p>
      </div>
    </Link>
  );
}
