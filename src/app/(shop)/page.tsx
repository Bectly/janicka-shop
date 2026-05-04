import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { ProductCard } from "@/components/shop/product-card";
import { CollectionCard } from "@/components/shop/collection-card";
import { NewsletterForm } from "@/components/shop/newsletter-form";
import { MothersDayBanner } from "@/components/shop/mothers-day-banner";
import { RecentlySoldFeed } from "@/components/shop/recently-sold-feed";
import { RecentlyViewedSection } from "@/components/shop/recently-viewed";
import { Button } from "@/components/ui/button";
import { getLowestPrices30d } from "@/lib/price-history";
import {
  MIN_VISIBLE_PRODUCTS,
  dailySeed,
  mergeWithFillers,
} from "@/lib/curated/fill-with-random";
import { BrandStripBento } from "@/components/shop/brand-strip-bento";
import { MarqueeStrip } from "@/components/shop/marquee-strip";
import { EditorialPullQuote } from "@/components/shop/editorial-pull-quote";
import { KategoriePeekGrid } from "@/components/shop/kategorie-peek-grid";
import { TrustStrip } from "@/components/shop/trust-strip";
import { JanickaMomentSection } from "@/components/shop/janicka-moment-section";
import { getSiteSetting, HERO_EDITORIAL_IMAGE_KEY } from "@/lib/site-settings";
import { getImageUrls } from "@/lib/images";
import { buildItemListSchema, buildWebSiteSchema, buildOrganizationSchema, jsonLdString } from "@/lib/structured-data";
import { ScrollReveal } from "@/components/shop/scroll-reveal";
import { ProductCarousel } from "@/components/shop/product-carousel";
import { Star, Tag, Heart, Layers, Mail } from "lucide-react";

/* ---------- Cached DB fetches (cross-request via "use cache") ---------- */

async function getNewProductsForPage() {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  try {
    const db = await getDb();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const include = {
      category: { select: { name: true } },
      _count: { select: { wishlistedBy: true } },
    } as const;
    const TARGET = 8;

    const recent = await db.product.findMany({
      where: { active: true, sold: false, createdAt: { gte: thirtyDaysAgo } },
      include,
      take: TARGET,
      orderBy: { createdAt: "desc" },
    });
    if (recent.length >= TARGET) return recent;

    const fillerPool = await db.product.findMany({
      where: {
        active: true,
        sold: false,
        id: { notIn: recent.map((p) => p.id) },
      },
      include,
      take: (TARGET - recent.length) * 3,
      orderBy: { createdAt: "desc" },
    });

    return mergeWithFillers(recent, fillerPool, {
      seed: dailySeed("new"),
      minVisible: MIN_VISIBLE_PRODUCTS,
      targetCount: TARGET,
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
    const include = {
      category: { select: { name: true } },
      _count: { select: { wishlistedBy: true } },
    } as const;
    const TARGET = 8;

    const featured = await db.product.findMany({
      where: { featured: true, active: true, sold: false },
      include,
      take: TARGET,
      orderBy: { createdAt: "desc" },
    });
    if (featured.length >= TARGET) return featured;

    const fillerPool = await db.product.findMany({
      where: {
        active: true,
        sold: false,
        id: { notIn: featured.map((p) => p.id) },
      },
      include,
      take: (TARGET - featured.length) * 3,
      orderBy: { createdAt: "desc" },
    });

    return mergeWithFillers(featured, fillerPool, {
      seed: dailySeed("featured"),
      minVisible: MIN_VISIBLE_PRODUCTS,
      targetCount: TARGET,
    });
  } catch {
    return [];
  }
}


/* ---------- Async streamed sections ---------- */

async function NewProductsSection() {
  const newProducts = await getNewProductsForPage();

  if (newProducts.length === 0) return null;

  const lowestPricesMap = await getLowestPrices30d(newProducts.map((p) => p.id));

  return (
    <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <Image
            src="/decor/dotted-divider.svg"
            alt=""
            aria-hidden="true"
            width={48}
            height={8}
            className="mb-stack-xs h-2 w-12 text-brand/30"
          />
          <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-[0.25em] text-brand uppercase">
            <span className="size-1.5 rounded-full bg-brand animate-pulse" aria-hidden="true" /> 01 / Nové
          </span>
          <h2 className="section-heading font-heading text-2xl font-bold text-foreground sm:text-3xl">
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
      <div className="mt-stack">
        <ProductCarousel ariaLabel="Nově přidané produkty">
          {newProducts.map((product, i) => (
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
              createdAt={product.createdAt.toISOString()}
              isReserved={false}
              lowestPrice30d={lowestPricesMap.get(product.id) ?? null}
              wishlistCount={product._count?.wishlistedBy ?? 0}
              priority={i < 4}
            />
          ))}
        </ProductCarousel>
      </div>
      <div className="mt-stack text-center sm:hidden">
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

  if (featuredProducts.length === 0) return null;

  const lowestPricesMap = await getLowestPrices30d(featuredProducts.map((p) => p.id));

  return (
    <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <Image
            src="/decor/dotted-divider.svg"
            alt=""
            aria-hidden="true"
            width={48}
            height={8}
            className="mb-stack-xs h-2 w-12 text-champagne-dark/40"
          />
          <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-champagne/50 px-3 py-1 text-xs font-semibold tracking-[0.25em] text-champagne-dark uppercase">
            <Star className="size-3" aria-hidden="true" /> 03 / Vybrané
          </span>
          <h2 className="section-heading font-heading text-2xl font-bold text-foreground sm:text-3xl">
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
      <div className="mt-stack grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
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
              wishlistCount={product._count?.wishlistedBy ?? 0}
              priority={i < 4}
              variant={i === 0 || i === 5 ? "featured" : "standard"}
            />
          </div>
        ))}
      </div>
      <div className="mt-stack text-center sm:hidden">
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
    const include = {
      category: { select: { name: true } },
      _count: { select: { wishlistedBy: true } },
    } as const;
    const TARGET = 8;

    const onSale = await db.product.findMany({
      where: { active: true, sold: false, compareAt: { not: null } },
      include,
      take: TARGET,
      orderBy: { createdAt: "desc" },
    });

    if (onSale.length >= TARGET) {
      saleProducts = onSale;
    } else if (onSale.length === 0) {
      return null;
    } else {
      const fillerPool = await db.product.findMany({
        where: {
          active: true,
          sold: false,
          id: { notIn: onSale.map((p) => p.id) },
        },
        include,
        take: (TARGET - onSale.length) * 3,
        orderBy: { createdAt: "desc" },
      });
      saleProducts = mergeWithFillers(onSale, fillerPool, {
        seed: dailySeed("sale"),
        minVisible: MIN_VISIBLE_PRODUCTS,
        targetCount: TARGET,
      });
      if (saleProducts.length === 0) return null;
    }

    lowestPricesMap = await getLowestPrices30d(saleProducts.map((p) => p.id));
  } catch {
    return null;
  }

  return (
    <section className="bg-brand/[0.04]">
      <div className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase">
              <Tag className="size-3" aria-hidden="true" /> Akce
            </span>
            <h2 className="section-heading font-heading text-2xl font-bold text-foreground sm:text-3xl">
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
        <div className="mt-stack grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
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
                wishlistCount={product._count?.wishlistedBy ?? 0}
                variant={i === 0 || i === 5 ? "featured" : "standard"}
              />
            </div>
          ))}
        </div>
        <div className="mt-stack text-center sm:hidden">
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
    <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
      <div className="text-center">
        <span className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase">
          <Heart className="size-3" aria-hidden="true" /> Značky
        </span>
        <h2 className="section-heading font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Populární značky
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Oblíbené značky v naší nabídce
        </p>
      </div>
      <div className="mt-stack flex flex-wrap justify-center gap-2.5">
        {popularBrands.map(([brand, count]) => (
          <Link
            key={brand}
            href={`/products?brand=${encodeURIComponent(brand)}`}
            className="group inline-flex h-11 items-center gap-1.5 rounded-full border border-border/60 bg-gradient-to-br from-card to-blush-light px-4 py-3 text-sm font-medium text-foreground/80 shadow-sm transition-all duration-200 hover:border-brand/30 hover:from-blush hover:to-brand-light/20 hover:text-primary"
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
    <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
      <div className="flex items-end justify-between">
        <div>
          <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-sage-light/60 px-3 py-1 text-xs font-semibold tracking-wider text-sage-dark uppercase">
            <Layers className="size-3" aria-hidden="true" /> Kolekce
          </span>
          <h2 className="section-heading font-heading text-2xl font-bold text-foreground sm:text-3xl">
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
      <div className="mt-stack grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="mt-stack-sm text-center sm:hidden">
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


/* ---------- Inline wavy divider ---------- */

function WavyDivider({
  tone,
}: {
  tone: "brand" | "champagne" | "sage" | "brand-light";
}) {
  const toneClass =
    tone === "brand"
      ? "text-brand/30"
      : tone === "champagne"
        ? "text-champagne-dark/40"
        : tone === "sage"
          ? "text-sage/40"
          : "text-brand-light/40";
  return (
    <div aria-hidden="true" className={toneClass}>
      <Image
        src="/decor/wavy-divider.svg"
        alt=""
        width={1440}
        height={24}
        className="h-auto w-full opacity-60"
      />
    </div>
  );
}


/* ---------- Main page ---------- */

export default async function HomePage() {
  await connection();
  const [editorialImageUrl, bentoProducts] = await Promise.all([
    getSiteSetting(HERO_EDITORIAL_IMAGE_KEY),
    getNewProductsForPage(),
  ]);
  const collageImages = bentoProducts
    .slice(0, 3)
    .map((p) => getImageUrls(p.images)[0] ?? null);

  return (
    <>
      {/* JSON-LD structured data — streamed, non-blocking */}
      <Suspense fallback={null}>
        <JsonLdSection />
      </Suspense>

      {/* 01 — BrandStripBento (info: copy + CTAs + 3-image collage) */}
      <BrandStripBento collageImages={collageImages} />
      <WavyDivider tone="brand" />

      {/* 02 — MarqueeStrip (Czech mottos scrolling) */}
      <MarqueeStrip />

      {/* 03 — NewProductsSection (products) */}
      <ScrollReveal>
        <Suspense fallback={<div className="max-h-[500px]" aria-hidden="true" />}>
          <NewProductsSection />
        </Suspense>
      </ScrollReveal>
      <WavyDivider tone="champagne" />

      {/* 04 — EditorialPullQuote (info: arch portrait + serif quote) */}
      <EditorialPullQuote portraitUrl={editorialImageUrl} />

      {/* Mother's Day banner — date-gated May 1–10, 2026 */}
      <Suspense fallback={null}>
        <MothersDayBanner />
      </Suspense>

      {/* 05 — KategoriePeekGrid (info+nav: asymmetric 4-tile) */}
      <Suspense fallback={<div className="max-h-[740px]" aria-hidden="true" />}>
        <KategoriePeekGrid />
      </Suspense>

      {/* 06 — FeaturedProductsSection (products) */}
      <ScrollReveal>
        <Suspense fallback={<div className="max-h-[1800px]" aria-hidden="true" />}>
          <FeaturedProductsSection />
        </Suspense>
      </ScrollReveal>
      <WavyDivider tone="sage" />

      {/* 07 — JanickaMomentSection (info: circle-frame portrait + story) */}
      <ScrollReveal>
        <JanickaMomentSection editorialImageUrl={editorialImageUrl} />
      </ScrollReveal>

      {/* 08 — RecentlySold (social proof ticker) */}
      <ScrollReveal>
        <Suspense fallback={<div className="max-h-[240px]" aria-hidden="true" />}>
          <RecentlySoldSection />
        </Suspense>
      </ScrollReveal>
      <WavyDivider tone="brand-light" />

      {/* 09 — TrustStrip (info: 4 trust tiles) */}
      <TrustStrip />

      {/* Downstream sections — unchanged order */}
      <ScrollReveal>
        <Suspense fallback={<div className="max-h-[1900px]" aria-hidden="true" />}>
          <FeaturedCollectionsSection />
        </Suspense>
      </ScrollReveal>

      <ScrollReveal>
        <Suspense fallback={<div className="max-h-[1800px]" aria-hidden="true" />}>
          <SaleProductsSection />
        </Suspense>
      </ScrollReveal>

      <ScrollReveal>
        <Suspense fallback={<div className="max-h-[340px]" aria-hidden="true" />}>
          <PopularBrandsSection />
        </Suspense>
      </ScrollReveal>

      {/* Recently viewed — client-side, renders instantly */}
      <ScrollReveal>
        <section className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
          <RecentlyViewedSection />
        </section>
      </ScrollReveal>

      {/* Newsletter — no data, renders instantly */}
      <ScrollReveal>
        <section className="relative overflow-hidden bg-gradient-to-br from-brand-light/30 via-blush to-champagne-light/50">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 size-64 rounded-full bg-brand/8 blur-3xl" />
            <div className="absolute -bottom-12 -right-12 size-48 rounded-full bg-champagne/30 blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
            <div className="mx-auto max-w-lg text-center">
              <span className="mx-auto mb-4 flex w-fit items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase">
                <Mail className="size-3" aria-hidden="true" /> Newsletter
              </span>
              <h2 className="section-heading font-heading text-2xl font-bold text-foreground sm:text-3xl">
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
