import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductCard } from "@/components/shop/product-card";
import { CategoryCard } from "@/components/shop/category-card";
import { NewsletterForm } from "@/components/shop/newsletter-form";
import { TrustBadges } from "@/components/shop/trust-badges";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getVisitorId } from "@/lib/visitor";
import { getLowestPrices30d } from "@/lib/price-history";
import { buildItemListSchema, buildWebSiteSchema, buildOrganizationSchema, jsonLdString } from "@/lib/structured-data";

export default async function HomePage() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [featuredProducts, categories, newProducts] = await Promise.all([
    prisma.product.findMany({
      where: { featured: true, active: true, sold: false },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { products: { where: { active: true, sold: false } } },
        },
      },
    }),
    prisma.product.findMany({
      where: { active: true, sold: false, createdAt: { gte: sevenDaysAgo } },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const visitorId = await getVisitorId();
  const now = new Date();

  // Get 30-day lowest prices for all displayed products
  const allProductIds = [
    ...featuredProducts.map((p) => p.id),
    ...newProducts.map((p) => p.id),
  ];
  const lowestPricesMap = await getLowestPrices30d(allProductIds);

  function isReservedByOther(p: { reservedUntil: Date | null; reservedBy: string | null }) {
    return !!p.reservedUntil && p.reservedUntil > now && p.reservedBy !== visitorId;
  }

  // Build JSON-LD structured data for product listings (SEO + AI search visibility)
  const allDisplayedProducts = [...newProducts, ...featuredProducts];
  const uniqueProducts = allDisplayedProducts.filter(
    (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i,
  );

  const itemListJsonLd = buildItemListSchema(
    uniqueProducts.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      images: p.images,
      sku: p.sku,
      brand: p.brand,
      condition: p.condition,
      price: p.price,
      sold: p.sold,
      categoryName: p.category.name,
    })),
    "Janička — Unikátní kousky za zlomek ceny",
    "/",
  );

  const webSiteJsonLd = buildWebSiteSchema();
  const organizationJsonLd = buildOrganizationSchema();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(webSiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">
              Second hand &amp; vintage
            </p>
            <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Unikátní kousky za&nbsp;zlomek ceny
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Každý kus je originál. Značkové oblečení v&nbsp;skvělém stavu,
              udržitelná móda pro moderní ženy.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" render={<Link href="/products" />}>
                Prohlédnout kolekci
                <ArrowRight data-icon="inline-end" className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                render={<Link href="/products?sale=true" />}
              >
                Výprodej
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              Kategorie
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Najděte přesně to, co hledáte
            </p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              name={cat.name}
              slug={cat.slug}
              description={cat.description}
              productCount={cat._count.products}
            />
          ))}
        </div>
      </section>

      {/* Newly added products */}
      {newProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">
                Nově přidané
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Čerstvé kousky za poslední týden
              </p>
            </div>
            <Link
              href="/products?sort=newest"
              className="hidden text-sm font-medium text-primary hover:underline sm:block"
            >
              Zobrazit vše &rarr;
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {newProducts.map((product) => (
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
                isNew
                isReserved={isReservedByOther(product)}
                lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
              />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Button
              variant="outline"
              render={<Link href="/products?sort=newest" />}
            >
              Zobrazit všechny novinky
            </Button>
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">
              Doporučujeme
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ručně vybrané kousky za nejlepší ceny
            </p>
          </div>
          <Link
            href="/products"
            className="hidden text-sm font-medium text-primary hover:underline sm:block"
          >
            Zobrazit vše &rarr;
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
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
              isReserved={isReservedByOther(product)}
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

      {/* Trust badges */}
      <TrustBadges />

      {/* Newsletter */}
      <section className="bg-primary/5">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-lg text-center">
            <h2 className="font-heading text-2xl font-bold text-foreground">
              Buďte v obraze
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Přihlaste se k odběru novinek a získejte slevu 10&nbsp;% na první
              nákup.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
