import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import { Search } from "lucide-react";
import { rateLimitSearch } from "@/lib/rate-limit";
import { getLowestPrices30d } from "@/lib/price-history";
import { buildItemListSchema, jsonLdString } from "@/lib/structured-data";
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
  const query = params.q?.trim().slice(0, 100) ?? "";

  // Rate limit: 30 searches per minute per IP
  let rateLimited = false;
  if (query.length > 0) {
    const rl = await rateLimitSearch();
    rateLimited = !rl.success;
  }

  // Two-pass search: DB-level LIKE filters first (case-insensitive for ASCII),
  // then JS-level pass handles Czech diacritics (Š/š, Č/č, Ř/ř) that SQLite misses.
  const dbResults =
    query.length > 0 && !rateLimited
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

  // If DB LIKE found enough results, use them directly.
  // Otherwise, fall back to JS-level filtering for diacritics-insensitive matching.
  // Czech users often search without háčky/čárky (e.g. "saty" instead of "šaty"),
  // so we normalize both query and text by stripping combining diacritical marks.
  let products = dbResults;
  if (query.length > 0 && !rateLimited && dbResults.length === 0) {
    const normQuery = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const all = await prisma.product.findMany({
      where: { active: true, sold: false },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    products = all
      .filter(
        (p) =>
          norm(p.name).includes(normQuery) ||
          norm(p.description).includes(normQuery) ||
          (p.brand ? norm(p.brand).includes(normQuery) : false) ||
          norm(p.sku).includes(normQuery)
      )
      .slice(0, 40);
  }

  // Fetch discovery data when search is empty or yields no results
  const showDiscovery = query.length === 0 || (products.length === 0 && !rateLimited);
  const [categories, featuredProducts] = showDiscovery
    ? await Promise.all([
        prisma.category.findMany({
          orderBy: { sortOrder: "asc" },
          select: { name: true, slug: true },
          take: 10,
        }),
        prisma.product.findMany({
          where: { active: true, sold: false, featured: true },
          include: { category: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 4,
        }),
      ])
    : [[], []];

  const allProductIds = [
    ...products.map((p) => p.id),
    ...featuredProducts.map((p) => p.id),
  ];
  const lowestPricesMap = await getLowestPrices30d(allProductIds);

  const searchJsonLd =
    query.length > 0 && products.length > 0
      ? buildItemListSchema(
          products.map((p) => ({
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
            categoryName: p.category.name,
            colors: p.colors,
            sizes: p.sizes,
          })),
          `Výsledky hledání: ${query}`,
          `/search?q=${encodeURIComponent(query)}`,
        )
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {searchJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(searchJsonLd) }}
        />
      )}
      <h1 className="sr-only">Vyhledávání</h1>
      {/* Search input */}
      <form action="/search" method="get" className="mx-auto max-w-xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="search-input" className="sr-only">Vyhledávání produktů</label>
          <input
            id="search-input"
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
        {rateLimited ? (
          <div className="py-20 text-center">
            <p className="text-lg text-muted-foreground">
              Příliš mnoho vyhledávání. Zkuste to prosím za chvíli.
            </p>
          </div>
        ) : query.length > 0 ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {products.length}{" "}
              {products.length === 1
                ? "výsledek"
                : products.length >= 2 && products.length <= 4
                  ? "výsledky"
                  : "výsledků"}{" "}
              pro &ldquo;{query}&rdquo;
            </p>

            {products.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    name={product.name}
                    slug={product.slug}
                    price={product.price}
                    compareAt={product.compareAt}
                    images={product.images}
                    categoryName={product.category.name}
                    brand={product.brand}
                    condition={product.condition}
                    sizes={product.sizes}
                    colors={product.colors}
                    lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <p className="text-lg text-muted-foreground">
                  Nic jsme nenašli pro &ldquo;{query}&rdquo;
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Zkuste jiný výraz nebo se podívejte na naše kategorie
                </p>
                {categories.length > 0 && (
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {categories.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/products?category=${cat.slug}`}
                        className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                )}
                {featuredProducts.length > 0 && (
                  <div className="mt-12 text-left">
                    <h2 className="font-heading text-lg font-bold text-foreground">
                      Mohlo by se vám líbit
                    </h2>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                      {featuredProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          id={product.id}
                          name={product.name}
                          slug={product.slug}
                          price={product.price}
                          compareAt={product.compareAt}
                          images={product.images}
                          categoryName={product.category.name}
                          brand={product.brand}
                          condition={product.condition}
                          sizes={product.sizes}
                          colors={product.colors}
                          lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="py-8">
            {/* Category quick links */}
            {categories.length > 0 && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Nebo procházejte podle kategorie
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/products?category=${cat.slug}`}
                      className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Featured products */}
            {featuredProducts.length > 0 && (
              <div className="mt-12">
                <h2 className="font-heading text-lg font-bold text-foreground">
                  Doporučujeme
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                  {featuredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.name}
                      slug={product.slug}
                      price={product.price}
                      compareAt={product.compareAt}
                      images={product.images}
                      categoryName={product.category.name}
                      brand={product.brand}
                      condition={product.condition}
                      sizes={product.sizes}
                      colors={product.colors}
                      lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
