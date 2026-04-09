import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { ProductCard } from "@/components/shop/product-card";
import { CategoryCard } from "@/components/shop/category-card";
import { NewsletterForm } from "@/components/shop/newsletter-form";
import { TrustBadges } from "@/components/shop/trust-badges";
import { VintedComparisonSection } from "@/components/shop/vinted-comparison";
import { MothersDayBanner } from "@/components/shop/mothers-day-banner";
import { RecentlySoldFeed } from "@/components/shop/recently-sold-feed";
import { RecentlyViewedSection } from "@/components/shop/recently-viewed";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight } from "lucide-react";
import { getLowestPrices30d } from "@/lib/price-history";
import { buildItemListSchema, buildWebSiteSchema, buildOrganizationSchema, jsonLdString } from "@/lib/structured-data";

/* ---------- Cached DB fetches (cross-request via "use cache") ---------- */

async function getNewProductsForPage() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const db = await getDb();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return db.product.findMany({
    where: { active: true, sold: false, createdAt: { gte: sevenDaysAgo } },
    include: { category: { select: { name: true } } },
    take: 8,
    orderBy: { createdAt: "desc" },
  });
}

async function getFeaturedProductsForPage() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const db = await getDb();
  return db.product.findMany({
    where: { featured: true, active: true, sold: false },
    include: { category: { select: { name: true } } },
    take: 8,
    orderBy: { createdAt: "desc" },
  });
}

/* ---------- Skeleton placeholders for streamed sections ---------- */

function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`space-y-3${i === 0 ? " col-span-2" : ""}`}>
          <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
          {i > 0 && (
            <>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

function BrandsSkeleton() {
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-2.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-24 rounded-full" />
      ))}
    </div>
  );
}

/* ---------- Async streamed sections ---------- */

async function CategoriesSection() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const db = await getDb();
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: { products: { where: { active: true, sold: false } } },
      },
    },
  });

  return (
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
  );
}

async function NewProductsSection() {
  const newProducts = await getNewProductsForPage();

  if (newProducts.length === 0) return null;

  const lowestPricesMap = await getLowestPrices30d(newProducts.map((p) => p.id));

  return (
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
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
        {newProducts.map((product, i) => (
          <div key={product.id} className={i === 0 ? "col-span-2" : undefined}>
            <ProductCard
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
              createdAt={product.createdAt.toISOString()}
              isReserved={false}
              lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
              priority={i < 4}
              variant={i === 0 ? "featured" : "standard"}
            />
          </div>
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
  );
}

async function FeaturedProductsSection() {
  const featuredProducts = await getFeaturedProductsForPage();

  const lowestPricesMap = await getLowestPrices30d(featuredProducts.map((p) => p.id));

  return (
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
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
        {featuredProducts.map((product, i) => (
          <div key={product.id} className={i === 0 ? "col-span-2" : undefined}>
            <ProductCard
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
              isReserved={false}
              lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
              priority={i < 4}
              variant={i === 0 ? "featured" : "standard"}
            />
          </div>
        ))}
      </div>
      <div className="mt-8 text-center sm:hidden">
        <Button variant="outline" render={<Link href="/products" />}>
          Zobrazit všechny produkty
        </Button>
      </div>
    </section>
  );
}

async function SaleProductsSection() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const db = await getDb();
  const saleProducts = await db.product.findMany({
    where: {
      active: true,
      sold: false,
      compareAt: { not: null },
    },
    include: { category: { select: { name: true } } },
    take: 8,
    orderBy: { createdAt: "desc" },
  });

  if (saleProducts.length === 0) return null;

  const lowestPricesMap = await getLowestPrices30d(saleProducts.map((p) => p.id));

  return (
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
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {saleProducts.map((product, i) => (
            <div key={product.id} className={i === 0 ? "col-span-2" : undefined}>
              <ProductCard
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
                isReserved={false}
                lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
                variant={i === 0 ? "featured" : "standard"}
              />
            </div>
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
  );
}

async function PopularBrandsSection() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const db = await getDb();
  const brandProducts = await db.product.groupBy({
    by: ["brand"],
    where: { active: true, sold: false, brand: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 15,
  });

  const popularBrands: [string, number][] = brandProducts
    .filter((g) => g.brand && g.brand.length > 0)
    .slice(0, 12)
    .map((g) => [g.brand!, g._count.id]);

  if (popularBrands.length === 0) return null;

  return (
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
  );
}

async function FeaturedCollectionsSection() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const db = await getDb();
  const featuredCollections = await db.collection.findMany({
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
  });

  if (featuredCollections.length === 0) return null;

  return (
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
        {featuredCollections.map((collection) => (
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
  );
}

async function RecentlySoldSection() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const db = await getDb();
  const recentlySold = await db.product.findMany({
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
  });

  const soldFeedProducts = recentlySold.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    images: p.images,
    categoryName: p.category.name,
    brand: p.brand,
    updatedAt: p.updatedAt,
  }));

  return <RecentlySoldFeed products={soldFeedProducts} />;
}

async function JsonLdSection() {
  // Re-uses cached results from NewProductsSection + FeaturedProductsSection — no extra DB queries.
  const [newProducts, featuredProducts] = await Promise.all([
    getNewProductsForPage(),
    getFeaturedProductsForPage(),
  ]);

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
    </>
  );
}

/* ---------- Section skeleton wrapper ---------- */

function SectionSkeleton({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div>
        <h2 className="font-heading text-2xl font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <ProductGridSkeleton />
    </section>
  );
}

/* ---------- Main page ---------- */

export default async function HomePage() {
  await connection();
  return (
    <>
      {/* JSON-LD structured data — streamed, non-blocking */}
      <Suspense fallback={null}>
        <JsonLdSection />
      </Suspense>

      {/* Hero — renders instantly, no data dependency */}
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

      {/* Mother's Day banner — date-gated May 1–10, 2026 */}
      <Suspense fallback={null}>
        <MothersDayBanner />
      </Suspense>

      {/* Categories — streams independently */}
      <Suspense fallback={
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div>
            <h2 className="font-heading text-2xl font-bold text-foreground">Kategorie</h2>
            <p className="mt-1 text-sm text-muted-foreground">Najděte přesně to, co hledáte</p>
          </div>
          <CategoriesSkeleton />
        </section>
      }>
        <CategoriesSection />
      </Suspense>

      {/* New products — streams independently */}
      <Suspense fallback={<SectionSkeleton title="Nově přidané" subtitle="Čerstvé kousky za poslední týden" />}>
        <NewProductsSection />
      </Suspense>

      {/* Featured products — streams independently */}
      <Suspense fallback={<SectionSkeleton title="Doporučujeme" subtitle="Ručně vybrané kousky za nejlepší ceny" />}>
        <FeaturedProductsSection />
      </Suspense>

      {/* Sale products — streams independently */}
      <Suspense fallback={<SectionSkeleton title="Výprodej" subtitle="Skvělé kousky za ještě lepší ceny" />}>
        <SaleProductsSection />
      </Suspense>

      {/* Popular brands — streams independently */}
      <Suspense fallback={
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-heading text-2xl font-bold text-foreground">Populární značky</h2>
            <p className="mt-1 text-sm text-muted-foreground">Oblíbené značky v naší nabídce</p>
          </div>
          <BrandsSkeleton />
        </section>
      }>
        <PopularBrandsSection />
      </Suspense>

      {/* Collections — streams independently */}
      <Suspense fallback={null}>
        <FeaturedCollectionsSection />
      </Suspense>

      {/* Trust badges — no data, renders instantly */}
      <TrustBadges />

      {/* Vinted trust comparison — no data, renders instantly */}
      <VintedComparisonSection />

      {/* Recently sold — streams independently */}
      <Suspense fallback={null}>
        <RecentlySoldSection />
      </Suspense>

      {/* Recently viewed — client-side, renders instantly */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <RecentlyViewedSection />
      </section>

      {/* Newsletter — no data, renders instantly */}
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
