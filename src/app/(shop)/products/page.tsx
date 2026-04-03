import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Katalog",
  description: "Prohlédněte si naši kolekci stylového oblečení pro moderní ženy.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string; sale?: string }>;
}) {
  const params = await searchParams;

  const where: Record<string, unknown> = { active: true, sold: false };

  if (params.category) {
    where.category = { slug: params.category };
  }

  if (params.sale === "true") {
    where.compareAt = { not: null };
  }

  const orderBy: Record<string, string> =
    params.sort === "price-asc"
      ? { price: "asc" }
      : params.sort === "price-desc"
        ? { price: "desc" }
        : { createdAt: "desc" };

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy,
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const activeCategory = categories.find((c) => c.slug === params.category);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          {activeCategory ? activeCategory.name : "Všechny produkty"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {products.length}{" "}
          {products.length === 1
            ? "produkt"
            : products.length < 5
              ? "produkty"
              : "produktů"}
        </p>
      </div>

      {/* Category filters */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/products"
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            !params.category
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Vše
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              params.category === cat.slug
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat.name}
          </Link>
        ))}
      </div>

      {/* Product grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              slug={product.slug}
              price={product.price}
              compareAt={product.compareAt}
              images={product.images}
              categoryName={product.category.name}
              brand={product.brand}
              condition={product.condition}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="text-lg text-muted-foreground">
            V této kategorii zatím nemáme žádné produkty.
          </p>
        </div>
      )}
    </div>
  );
}
