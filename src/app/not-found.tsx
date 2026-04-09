export const revalidate = 60;

import Link from "next/link";
import { getDb } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLowestPrices30d } from "@/lib/price-history";

export default async function NotFound() {
  let categories: { name: string; slug: string }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let latestProducts: any[] = [];
  let lowestPricesMap = new Map<string, number>();

  try {
    const db = await getDb();
    [categories, latestProducts] = await Promise.all([
      db.category.findMany({
        orderBy: { sortOrder: "asc" },
        select: { name: true, slug: true },
      }),
      db.product.findMany({
        where: { active: true, sold: false },
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
    ]);

    lowestPricesMap = await getLowestPrices30d(
      latestProducts.map((p: { id: string }) => p.id),
    );
  } catch {
    // DB unavailable — render 404 without product suggestions
  }

  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          {/* 404 message */}
          <div className="mx-auto max-w-lg text-center">
            <p className="text-6xl font-bold text-primary/20">404</p>
            <h1 className="mt-4 font-heading text-2xl font-bold text-foreground sm:text-3xl">
              Tenhle kousek jsme nenašli
            </h1>
            <p className="mt-3 text-muted-foreground">
              Možná už má novou majitelku, nebo se stránka přestěhovala.
              Zkuste vyhledat nebo se podívejte na naše nejnovější kousky.
            </p>

            {/* Search */}
            <form action="/search" method="get" className="mt-8">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <label htmlFor="notfound-search" className="sr-only">
                  Vyhledávání produktů
                </label>
                <input
                  id="notfound-search"
                  type="search"
                  name="q"
                  placeholder="Hledejte podle názvu, značky..."
                  className="w-full rounded-xl border bg-background py-3 pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </form>

            {/* Category links */}
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
          </div>

          {/* Latest products */}
          {latestProducts.length > 0 && (
            <section className="mt-16">
              <div className="flex items-end justify-between">
                <h2 className="font-heading text-xl font-bold text-foreground">
                  Nejnovější kousky
                </h2>
                <Link
                  href="/products"
                  className="hidden text-sm font-medium text-primary hover:underline sm:block"
                >
                  Zobrazit vše
                  <ArrowRight className="ml-1 inline size-3.5" />
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {latestProducts.map((product) => (
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
                    stock={product.stock}
                    lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                  />
                ))}
              </div>
              <div className="mt-8 text-center sm:hidden">
                <Button variant="outline" render={<Link href="/products" />}>
                  Zobrazit všechny produkty
                </Button>
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
