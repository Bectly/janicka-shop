import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { ProductCard } from "@/components/shop/product-card";
import { CategoryCard } from "@/components/shop/category-card";
import { CollectionCard } from "@/components/shop/collection-card";
import { NewsletterForm } from "@/components/shop/newsletter-form";
import { TrustBadges } from "@/components/shop/trust-badges";
import { MothersDayBanner } from "@/components/shop/mothers-day-banner";
import { RecentlySoldFeed } from "@/components/shop/recently-sold-feed";
import { RecentlyViewedSection } from "@/components/shop/recently-viewed";
import { Button } from "@/components/ui/button";
import { getLowestPrices30d } from "@/lib/price-history";
import { HeroSection } from "@/components/shop/hero-section";
import { buildItemListSchema, buildWebSiteSchema, buildOrganizationSchema, jsonLdString } from "@/lib/structured-data";
import { ScrollReveal } from "@/components/shop/scroll-reveal";
import { LayoutGrid, Star, Tag, Heart, Layers, Mail } from "lucide-react";

/* ---------- Cached DB fetches (cross-request via "use cache") ---------- */

async function getNewProductsForPage() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  try {
    const db = await getDb();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = await db.product.findMany({
      where: { active: true, sold: false, createdAt: { gte: thirtyDaysAgo } },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
    if (recent.length > 0) return recent;
    // Fallback: if nothing in last 30 days, show the 8 most recently added products
    return db.product.findMany({
      where: { active: true, sold: false },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

async function getFeaturedProductsForPage() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  try {
    const db = await getDb();
    const featured = await db.product.findMany({
      where: { featured: true, active: true, sold: false },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
    if (featured.length > 0) return featured;
    // Fallback: if nothing is marked featured, show latest active products so the
    // "Doporučujeme" section still renders meaningful content.
    return db.product.findMany({
      where: { active: true, sold: false },
      include: { category: { select: { name: true } } },
      take: 8,
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}


/* ---------- Async streamed sections ---------- */

async function CategoriesSection() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  let categories;
  try {
    const db = await getDb();
    categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { products: { where: { active: true, sold: false } } },
        },
      },
    });
  } catch {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase mb-3">
            <LayoutGrid className="size-3" aria-hidden="true" /> Kategorie
          </span>
          <h2 className="section-heading font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase mb-3">
            <span className="size-1.5 rounded-full bg-brand animate-pulse" aria-hidden="true" /> Nové
          </span>
          <h2 className="section-heading font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
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
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {newProducts.map((product, i) => (
          <div key={product.id} className={i === 0 || i === 5 ? "col-span-2" : undefined}>
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
              variant={i === 0 || i === 5 ? "featured" : "standard"}
            />
          </div>
        ))}
      </div>
      <div className="mt-8 text-center sm:hidden">
        <Button
          variant="outline"
          className="min-h-[44px]"
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

  if (featuredProducts.length === 0) return null;

  const lowestPricesMap = await getLowestPrices30d(featuredProducts.map((p) => p.id));

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-champagne/50 px-3 py-1 text-xs font-semibold tracking-wider text-champagne-dark uppercase mb-3">
            <Star className="size-3" aria-hidden="true" /> Výběr
          </span>
          <h2 className="section-heading font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
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
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {featuredProducts.map((product, i) => (
          <div key={product.id} className={i === 0 || i === 5 ? "col-span-2" : undefined}>
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
              variant={i === 0 || i === 5 ? "featured" : "standard"}
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
  let saleProducts;
  let lowestPricesMap;
  try {
    const db = await getDb();
    saleProducts = await db.product.findMany({
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

    lowestPricesMap = await getLowestPrices30d(saleProducts.map((p) => p.id));
  } catch {
    return null;
  }

  return (
    <section className="bg-brand/[0.04]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase mb-3">
              <Tag className="size-3" aria-hidden="true" /> Akce
            </span>
            <h2 className="section-heading font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
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
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {saleProducts.map((product, i) => (
            <div key={product.id} className={i === 0 || i === 5 ? "col-span-2" : undefined}>
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
                variant={i === 0 || i === 5 ? "featured" : "standard"}
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
  let popularBrands: [string, number][];
  try {
    const db = await getDb();
    const brandProducts = await db.product.groupBy({
      by: ["brand"],
      where: { active: true, sold: false, brand: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    });

    popularBrands = brandProducts
      .filter((g) => g.brand && g.brand.length > 0)
      .slice(0, 12)
      .map((g) => [g.brand!, g._count.id]);
  } catch {
    return null;
  }

  if (popularBrands.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          <Heart className="size-3" aria-hidden="true" /> Značky
        </span>
        <h2 className="section-heading font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
          Populární značky
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Oblíbené značky v naší nabídce
        </p>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-2.5">
        {popularBrands.map(([brand, count]) => (
          <Link
            key={brand}
            href={`/products?brand=${encodeURIComponent(brand)}`}
            className="group inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border/60 bg-gradient-to-br from-card to-blush-light px-4 py-3 text-sm font-medium text-foreground/80 shadow-sm transition-all duration-200 hover:border-brand/30 hover:from-blush hover:to-brand-light/20 hover:text-primary hover:shadow-[0_4px_14px_-4px_oklch(0.55_0.20_350_/_0.15)]"
          >
            {brand}
            <span className="text-[11px] text-muted-foreground/60 transition-colors group-hover:text-primary/50">
              {count}
            </span>
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
  let featuredCollections;
  try {
    const db = await getDb();
    featuredCollections = await db.collection.findMany({
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
  } catch {
    return null;
  }

  if (featuredCollections.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-light/60 px-3 py-1 text-xs font-semibold tracking-wider text-sage-dark uppercase mb-3">
            <Layers className="size-3" aria-hidden="true" /> Kolekce
          </span>
          <h2 className="section-heading font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
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
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featuredCollections.map((collection, i) => (
          <CollectionCard
            key={collection.id}
            slug={collection.slug}
            title={collection.title}
            description={collection.description}
            image={collection.image}
            priority={i < 2}
            index={i}
            wide={i === 0 && featuredCollections.length > 2}
          />
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
  let soldFeedProducts;
  try {
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

    soldFeedProducts = recentlySold.map((p) => ({
      name: p.name,
      slug: p.slug,
      price: p.price,
      images: p.images,
      categoryName: p.category.name,
      brand: p.brand,
      updatedAt: p.updatedAt,
    }));
  } catch {
    return null;
  }

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



/* ---------- Main page ---------- */

export default async function HomePage() {
  await connection();
  return (
    <>
      {/* JSON-LD structured data — streamed, non-blocking */}
      <Suspense fallback={null}>
        <JsonLdSection />
      </Suspense>

      {/* Hero — dominant logo + brand statement + cherry blossom particles */}
      <HeroSection />

      {/* Mother's Day banner — date-gated May 1–10, 2026 */}
      <Suspense fallback={null}>
        <MothersDayBanner />
      </Suspense>

      {/* New products — above-fold priority on mobile (Sage C4803) */}
      <ScrollReveal>
        <Suspense fallback={null}>
          <NewProductsSection />
        </Suspense>
      </ScrollReveal>

      {/* Categories — streams independently */}
      <Suspense fallback={null}>
        <CategoriesSection />
      </Suspense>

      {/* Featured products — streams independently */}
      <ScrollReveal>
        <Suspense fallback={null}>
          <FeaturedProductsSection />
        </Suspense>
      </ScrollReveal>

      {/* Sale products — streams independently */}
      <ScrollReveal>
        <Suspense fallback={null}>
          <SaleProductsSection />
        </Suspense>
      </ScrollReveal>

      {/* Popular brands — streams independently */}
      <ScrollReveal>
        <Suspense fallback={null}>
          <PopularBrandsSection />
        </Suspense>
      </ScrollReveal>

      {/* Collections — streams independently */}
      <ScrollReveal>
        <Suspense fallback={null}>
          <FeaturedCollectionsSection />
        </Suspense>
      </ScrollReveal>

      {/* Trust badges — no data, renders instantly */}
      <ScrollReveal>
        <TrustBadges />
      </ScrollReveal>

      {/* Recently sold — streams independently */}
      <ScrollReveal>
        <Suspense fallback={null}>
          <RecentlySoldSection />
        </Suspense>
      </ScrollReveal>

      {/* Recently viewed — client-side, renders instantly */}
      <ScrollReveal>
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <RecentlyViewedSection />
        </section>
      </ScrollReveal>

      {/* Newsletter — no data, renders instantly */}
      <ScrollReveal>
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-light/30 via-blush to-champagne-light/50">
          {/* Decorative background glow */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 size-64 rounded-full bg-brand/8 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 size-48 rounded-full bg-champagne/30 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-lg text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase mb-4">
                <Mail className="size-3" aria-hidden="true" /> Newsletter
              </span>
              <h2 className="section-heading font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
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
      </ScrollReveal>
    </>
  );
}
