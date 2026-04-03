import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import { Search } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hledat",
  description: "Hledejte v naší kolekci oblečení.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const products =
    query.length > 0
      ? await prisma.product.findMany({
          where: {
            active: true,
            sold: false,
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
              { brand: { contains: query } },
              { sku: { contains: query } },
            ],
          },
          include: { category: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 40,
        })
      : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Search input */}
      <form action="/search" method="get" className="mx-auto max-w-xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Hledejte podle názvu, značky, popisu..."
            autoFocus
            className="w-full rounded-xl border bg-background py-3 pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </form>

      {/* Results */}
      <div className="mt-8">
        {query.length > 0 ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {products.length}{" "}
              {products.length === 1
                ? "výsledek"
                : products.length < 5
                  ? "výsledky"
                  : "výsledků"}{" "}
              pro &ldquo;{query}&rdquo;
            </p>

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
                  Nic jsme nenašli. Zkuste jiný výraz.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">
              Začněte psát a najdeme to za vás.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
