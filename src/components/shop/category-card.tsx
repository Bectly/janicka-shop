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

export function CategoryCard({
  name,
  slug,
  description,
  productCount,
}: CategoryCardProps) {
  return (
    <Link
      href={`/products?category=${slug}`}
      className="group flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-md"
    >
      <span className="text-4xl" role="img" aria-label={name}>
        {categoryIcons[slug] ?? "🏷️"}
      </span>
      <div>
        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
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
