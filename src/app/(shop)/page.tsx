import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
import { ProductCard } from "@/components/shop/product-card";
import { CategoryCard } from "@/components/shop/category-card";
import { NewsletterForm } from "@/components/shop/newsletter-form";
import { TrustBadges } from "@/components/shop/trust-badges";
import { RecentlySoldFeed } from "@/components/shop/recently-sold-feed";
import { RecentlyViewedSection } from "@/components/shop/recently-viewed";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getVisitorId } from "@/lib/visitor";
import { getLowestPrices30d } from "@/lib/price-history";
import { buildItemListSchema, buildWebSiteSchema, buildOrganizationSchema, jsonLdString } from "@/lib/structured-data";

export default async function HomePage() {
  const db = await getDb();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [featuredProducts, categories, newProducts, recentlySold, brandProducts, saleProducts, featuredCollections] = await Promise.all([
    db.product.findMany({
      where: { featured: true, active: true, sold: false },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    db.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { products: { where: { active: true, sold: false } } },
        },
      },
    }),
    db.product.findMany({
      where: { active: true, sold: false, createdAt: { gte: sevenDaysAgo } },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({
      where: { sold: true, active: true },
      select: {
        name: true,
        slug: true,
        price: true,
        images: true,
        brand: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
      take: 8,
      orderBy: { updatedAt: "desc" },
    }),
    db.product.findMany({
      where: { active: true, sold: false, brand: { not: null } },
      select: { brand: true },
    }),
    db.product.findMany({
      where: {
        active: true,
        sold: false,
        compareAt: { not: null },
      },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    db.collection.findMany({
      where: {
        active: true,
        featured: true,
        OR: [
          { startDate: null },
          { startDate: { lte: new Date() } },
        ],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const visitorId = await getVisitorId();
  const now = new Date();

  // Get 30-day lowest prices for all displayed products
  const allProductIds = [
    ...featuredProducts.map((p) => p.id),
    ...newProducts.map((p) => p.id),
    ...saleProducts.map((p) => p.id),
  ];
  const lowestPricesMap = await getLowestPrices30d(allProductIds);

  function isReservedByOther(p: { reservedUntil: Date | null; reservedBy: string | null }) {
    return !!p.reservedUntil && p.reservedUntil > now && p.reservedBy !== visitorId;
  }

  // Compute popular brands sorted by product count
  const brandCounts = new Map<string, number>();
  for (const p of brandProducts) {
    if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  }
  const popularBrands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  // Map recently sold products for the feed component
  const soldFeedProducts = recentlySold.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    images: p.images,
    categoryName: p.category.name,
    brand: p.brand,
    updatedAt: p.updatedAt,
  }));

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
      compareAt: p.compareAt,
      sold: p.sold,
      categoryName: p.category.name,
      colors: p.colors,
      sizes: p.sizes,
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
                sizes={product.sizes}
                colors={product.colors}
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
              sizes={product.sizes}
              colors={product.colors}
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

      {/* Sale / discounted products */}
      {saleProducts.length > 0 && (
        <section className="bg-rose-50/50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Výprodej
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Skvělé kousky za ještě lepší ceny
                </p>
              </div>
              <Link
                href="/products?sale=true"
                className="hidden text-sm font-medium text-primary hover:underline sm:block"
              >
                Zobrazit vše &rarr;
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {saleProducts.map((product) => (
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
                  isReserved={isReservedByOther(product)}
                  lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                />
              ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <Button
                variant="outline"
                render={<Link href="/products?sale=true" />}
              >
                Zobrazit celý výprodej
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Popular brands */}
      {popularBrands.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold text-foreground">
              Populární značky
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Oblíbené značky v naší nabídce
            </p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {popularBrands.map(([brand, count]) => (
              <Link
                key={brand}
                href={`/products?brand=${encodeURIComponent(brand)}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              >
                {brand}
                <span className="text-xs text-muted-foreground">({count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured collections */}
      {featuredCollections.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold text-foreground">
                Kolekce
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kurátorské výběry podle stylu a sezóny
              </p>
            </div>
            <Link
              href="/collections"
              className="hidden text-sm font-medium text-primary hover:underline sm:block"
            >
              Všechny kolekce &rarr;
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCollections
              .map((collection) => (
                <Link
                  key={collection.id}
                  href={`/collections/${collection.slug}`}
                  className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  {collection.image ? (
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      <Image
                        src={collection.image}
                        alt={collection.title}
                        width={640}
                        height={360}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10">
                      <span className="font-heading text-xl font-bold text-primary/40">
                        {collection.title}
                      </span>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-heading text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                      {collection.title}
                    </h3>
                    {collection.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {collection.description}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
          </div>
          <div className="mt-6 text-center sm:hidden">
            <Button variant="outline" render={<Link href="/collections" />}>
              Všechny kolekce
            </Button>
          </div>
        </section>
      )}

      {/* Trust badges */}
      <TrustBadges />

      {/* Recently sold — social proof */}
      <RecentlySoldFeed products={soldFeedProducts} />

      {/* Recently viewed — personalization for returning visitors */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <RecentlyViewedSection />
      </section>

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
