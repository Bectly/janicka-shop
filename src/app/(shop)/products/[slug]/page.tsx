import { Suspense } from "react";
import Link from "next/link";
import { getImageProps } from "next/image";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { getProductBySlug } from "@/lib/products-cache";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { ProductCard } from "@/components/shop/product-card";
import { ProductCarousel } from "@/components/shop/product-carousel";
import { ProductGallery } from "@/components/shop/product-gallery";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { getLowestPrices30d } from "@/lib/price-history";
import { buildProductSchema, buildBreadcrumbSchema, buildFaqSchema, buildVideoObjectSchema, jsonLdString } from "@/lib/structured-data";
import { ShareButtons } from "@/components/shop/share-buttons";
import { WishlistButton } from "@/components/shop/wishlist-button";
import {
  TrackProductView,
  RecentlyViewedSection,
} from "@/components/shop/recently-viewed";
import { ProductInfoAccordion } from "@/components/shop/product-info-accordion";
import { ProductDefects } from "@/components/shop/product-defects";
import { ProductDescription } from "@/components/shop/product-description";
import { parseDefectImages } from "@/lib/defects";
import { FreeShippingBar } from "@/components/shop/free-shipping-bar";
import { NotifyMeForm } from "@/components/shop/notify-me-form";
import { BackInStockForm } from "@/components/shop/back-in-stock-form";
import { MeasurementGuide } from "@/components/shop/measurement-guide";
import { BrowseAbandonmentTracker } from "@/components/shop/browse-abandonment-tracker";
import { Truck, Leaf, Ruler, Sparkles, Heart } from "lucide-react";
import { parseProductImages, parseMeasurements, hasMeasurements } from "@/lib/images";
import { Skeleton } from "@/components/ui/skeleton";
import type { Metadata } from "next";

/**
 * Calculate estimated delivery date range.
 * Handling: 1-2 business days, Transit: 1-3 business days.
 * Skips weekends.
 */
function getEstimatedDelivery(): { from: Date; to: Date } {
  const now = new Date();
  const addBusinessDays = (start: Date, days: number): Date => {
    const result = new Date(start);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return result;
  };
  // Min: 1 handling + 1 transit = 2 business days
  // Max: 2 handling + 3 transit = 5 business days
  return {
    from: addBusinessDays(now, 2),
    to: addBusinessDays(now, 5),
  };
}

function formatDeliveryDate(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).format(date);
}

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://jvsatnik.cz";

async function getProduct(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`product-${slug}`, "products");
  const product = await getProductBySlug(slug);
  if (!product) return null;
  const lowestPricesMap = await getLowestPrices30d([product.id]);
  return { ...product, lowestPrice30d: lowestPricesMap.get(product.id) ?? null };
}

function RelatedProductsSkeleton() {
  return (
    <section className="mt-16">
      <div className="mb-6">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="mt-3 h-7 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="aspect-[3/4] w-full rounded-xl" />
            <div className="mt-3 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

async function RelatedProductsSection({
  productId,
  categoryId,
  sold,
  productSizes,
  productPrice,
  productBrand,
}: {
  productId: string;
  categoryId: string;
  sold: boolean;
  productSizes: string;
  productPrice: number;
  productBrand: string | null;
}) {
  const db = await getDb();
  const relatedQuery = {
    where: {
      categoryId,
      id: { not: productId },
      active: true,
      sold: false,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      compareAt: true,
      images: true,
      brand: true,
      condition: true,
      sizes: true,
      colors: true,
      stock: true,
      createdAt: true,
      reservedUntil: true,
      reservedBy: true,
      category: { select: { name: true } },
    },
  } as const;

  const relatedProducts = sold
    ? await (async () => {
        const candidates = await db.product.findMany({ ...relatedQuery, take: 20 });
        let soldSizes: string[] = [];
        try { soldSizes = JSON.parse(productSizes); } catch { /* */ }
        const scored = candidates.map((p) => {
          let score = 0;
          try {
            const pSizes: string[] = JSON.parse(p.sizes);
            if (soldSizes.length > 0 && pSizes.some((s) => soldSizes.includes(s))) score += 10;
          } catch { /* */ }
          const priceDiff = Math.abs(p.price - productPrice);
          score += Math.max(0, 5 - priceDiff / 100);
          if (p.brand && p.brand === productBrand) score += 3;
          return { product: p, score };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 8).map((s) => s.product);
      })()
    : await db.product.findMany({ ...relatedQuery, take: 8 });

  if (relatedProducts.length === 0) return null;

  const allIds = [productId, ...relatedProducts.map((p) => p.id)];
  const lowestPricesMap = await getLowestPrices30d(allIds);

  if (sold) {
    return (
      <section className="mt-16">
        <div className="mb-6">
          <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-sage-light/60 px-3 py-1 text-xs font-semibold tracking-wider text-sage-dark uppercase">
            <span aria-hidden="true">◈</span> Podobné
          </span>
          <h2 className="font-heading text-xl font-bold text-foreground">
            Podobné dostupné kousky
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vybrali jsme kousky podobné velikosti, ceny a stylu
          </p>
        </div>
        <ProductCarousel ariaLabel="Podobné dostupné kousky">
          {relatedProducts.map((p) => (
            <ProductCard
              key={p.id}
              id={p.id}
              name={p.name}
              slug={p.slug}
              price={p.price}
              compareAt={p.compareAt}
              images={p.images}
              categoryName={p.category.name}
              brand={p.brand}
              condition={p.condition}
              sizes={p.sizes}
              colors={p.colors}
              stock={p.stock}
              createdAt={p.createdAt.toISOString()}
              isReserved={false}
              lowestPrice30d={lowestPricesMap.get(p.id) ?? null}
            />
          ))}
        </ProductCarousel>
      </section>
    );
  }

  return (
    <section className="mt-16">
      <div className="mb-6">
        <span className="mb-3 flex w-fit items-center gap-1.5 rounded-full bg-champagne/50 px-3 py-1 text-xs font-semibold tracking-wider text-champagne-dark uppercase">
          <span aria-hidden="true">★</span> Výběr
        </span>
        <h2 className="font-heading text-xl font-bold text-foreground">
          Mohlo by se vám líbit
        </h2>
      </div>
      <ProductCarousel ariaLabel="Mohlo by se vám líbit">
        {relatedProducts.map((p) => (
          <ProductCard
            key={p.id}
            id={p.id}
            name={p.name}
            slug={p.slug}
            price={p.price}
            compareAt={p.compareAt}
            images={p.images}
            categoryName={p.category.name}
            brand={p.brand}
            condition={p.condition}
            sizes={p.sizes}
            colors={p.colors}
            createdAt={p.createdAt.toISOString()}
            isReserved={false}
            lowestPrice30d={lowestPricesMap.get(p.id) ?? null}
          />
        ))}
      </ProductCarousel>
    </section>
  );
}

interface Props {
  params: Promise<{ slug: string }>;
}

/** OG condition label for product meta */
const OG_CONDITION: Record<string, string> = {
  new_with_tags: "new",
  new_without_tags: "new",
  excellent: "used",
  good: "used",
  visible_wear: "used",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const structuredImages = parseProductImages(product.images);
  const imageUrls = structuredImages.map((img) => img.url);

  // Richer description with price + brand for social preview cards
  const priceText = `${product.price} Kč`;
  const brandText = product.brand ? ` | ${product.brand}` : "";
  const condLabel = CONDITION_LABELS[product.condition] ?? "";
  const autoDescription = `${priceText}${brandText} | ${condLabel}. ${product.description}`.slice(0, 200);

  // Custom SEO overrides (set in admin) take priority; otherwise fall back to derived values
  const metaTitle = product.metaTitle?.trim() || product.name;
  const metaDescription = product.metaDescription?.trim() || product.description;
  const ogDescription = product.metaDescription?.trim() || autoDescription;

  // Multiple OG images for carousel previews (up to 4)
  const ogImages = structuredImages.slice(0, 4).map((img) => ({
    url: img.url,
    alt: img.alt || product.name,
    width: 800,
    height: 800,
  }));

  return {
    title: metaTitle,
    description: metaDescription,
    alternates: {
      canonical: `${BASE_URL}/products/${product.slug}`,
    },
    openGraph: {
      title: `${metaTitle} — ${priceText}`,
      description: ogDescription,
      url: `${BASE_URL}/products/${product.slug}`,
      type: "website",
      siteName: "Janička",
      locale: "cs_CZ",
      ...(ogImages.length > 0 && { images: ogImages }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${metaTitle} — ${priceText}`,
      description: ogDescription,
      ...(imageUrls.length > 0 && { images: [imageUrls[0]] }),
    },
    other: {
      "product:price:amount": String(product.price),
      "product:price:currency": "CZK",
      "product:condition": OG_CONDITION[product.condition] ?? "used",
      ...(product.brand ? { "product:brand": product.brand } : {}),
      "product:availability": product.sold ? "out of stock" : "in stock",
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  const product = await getProduct(slug);

  if (!product) notFound();


  // JSON-LD structured data for SEO (Google Shopping + AI search visibility)
  // "Golden Record" — complete attributes for 3-4x higher AI visibility
  const jsonLd = {
    "@context": "https://schema.org",
    ...buildProductSchema({
      slug: product.slug,
      name: product.name,
      description: product.description,
      images: product.images,
      sku: product.sku,
      brand: product.brand,
      condition: product.condition,
      price: product.price,
      compareAt: product.compareAt,
      sold: product.sold,
      categoryName: product.category.name,
      colors: product.colors,
      sizes: product.sizes,
      videoUrl: product.videoUrl,
      createdAt: product.createdAt,
      measurements: product.measurements,
    }),
  };

  // Standalone VideoObject for Google Video rich results / Discover (+22% CTR)
  const videoJsonLd = buildVideoObjectSchema({
    name: product.name,
    description: product.description,
    videoUrl: product.videoUrl,
    images: product.images,
    createdAt: product.createdAt,
  });

  const breadcrumbJsonLd = buildBreadcrumbSchema([
    { name: "Katalog", url: "/products" },
    { name: product.category.name, url: `/products?category=${product.category.slug}` },
    { name: product.name, url: `/products/${product.slug}` },
  ]);

  // FAQ structured data — mirrors the product info accordion (shipping, returns, quality)
  const faqJsonLd = buildFaqSchema([
    {
      question: "Jaké jsou možnosti dopravy a ceny?",
      answer:
        "Zásilkovna — výdejní místo: 69 Kč. Zásilkovna — na adresu: 99 Kč. Česká pošta: 89 Kč. Doprava zdarma od 1 500 Kč. Objednávky odesíláme do 1–2 pracovních dnů.",
    },
    {
      question: "Jaké jsou podmínky vrácení a reklamace?",
      answer:
        "Máte 14 dní na vrácení zboží bez udání důvodu od převzetí zásilky. Zboží musí být nepoškozené, neprané a v původním stavu. Záruční doba na použité zboží je 12 měsíců. Reklamace vyřídíme do 30 dnů.",
    },
    {
      question: "Jak zajišťujete kvalitu second hand oblečení?",
      answer:
        "Každý kousek pečlivě kontrolujeme a fotografujeme. Stav je vždy přesně popsán — žádná nepříjemná překvapení.",
    },
  ]);

  const productImages = parseProductImages(product.images);
  const measurements = parseMeasurements(product.measurements);
  const defectImages = parseDefectImages(product.defectImages);

  // Hoist hero-image preload into <head> — React 19 auto-hoists <link> from body.
  // Computed ABOVE the sold/live fork so BOTH branches emit the preload; without it,
  // the <Image priority> inside the client-component gallery only emits its preload
  // during hydration, pushing resourceLoadDelay past 3s on mobile fresh-cache runs
  // (regressed 2710→3206ms per C4867 #484). getImageProps mirrors next/image's
  // optimized srcset so the preload matches the exact candidate <img> will request.
  const heroImage = productImages[0];
  const heroPreload = heroImage
    ? getImageProps({
        src: heroImage.url,
        alt: "",
        width: 800,
        height: 1067,
        sizes: "(max-width: 1024px) 100vw, 50vw",
        quality: 90,
      }).props
    : null;

  // --- SOLD PRODUCT VIEW ---
  if (product.sold) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {heroPreload && (
          <link
            rel="preload"
            as="image"
            href={heroPreload.src}
            imageSrcSet={heroPreload.srcSet}
            imageSizes={heroPreload.sizes}
            fetchPriority="high"
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
        />
        {videoJsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdString(videoJsonLd) }}
          />
        )}
        <nav className="mb-6 flex min-w-0 flex-wrap items-center gap-y-1 text-sm text-muted-foreground">
          <Link href="/products" className="shrink-0 transition-colors duration-150 hover:text-foreground">
            Katalog
          </Link>
          <span className="mx-2 shrink-0">/</span>
          <Link
            href={`/products?category=${product.category.slug}`}
            className="shrink-0 transition-colors duration-150 hover:text-foreground"
          >
            {product.category.name}
          </Link>
          <span className="mx-2 shrink-0">/</span>
          <span className="min-w-0 truncate text-foreground">{product.name}</span>
        </nav>

        <div className="grid min-w-0 grid-cols-1 gap-8 overflow-hidden lg:grid-cols-2 lg:gap-12">
          {/* Image — greyed out */}
          <div className="relative min-w-0 overflow-hidden">
            <div className="opacity-60 grayscale">
              <ProductGallery images={productImages} productName={product.name} videoUrl={product.videoUrl} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-foreground/80 px-6 py-2 text-lg font-bold text-background">
                Prodáno
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{product.category.name}</span>
              {product.brand && (
                <>
                  <span className="text-muted-foreground/50">&middot;</span>
                  <span className="font-medium">{product.brand}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
              {product.name}
            </h1>

            <div className="mt-6 rounded-2xl bg-gradient-to-br from-brand-light/15 via-blush/25 to-champagne/20 p-8 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-light/40 to-brand/15 ring-1 ring-brand/10">
                <Heart className="size-6 text-brand" />
              </div>
              <p className="font-heading text-lg font-semibold text-foreground">
                Tento kousek už má novou majitelku
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Každý náš kousek je unikát — žádné kopie, žádné série.
              </p>
              <Link
                href={`/products?category=${product.category.slug}`}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-brand-dark"
              >
                Prohlédnout {product.category.name.toLowerCase()} →
              </Link>
            </div>

            {/* Back-in-stock — tight match (brand+size+condition), unique-inventory angle */}
            <BackInStockForm
              categoryId={product.categoryId}
              brand={product.brand}
              size={(() => {
                try {
                  const arr = JSON.parse(product.sizes) as unknown;
                  if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
                    return arr[0];
                  }
                } catch {
                  /* ignore */
                }
                return null;
              })()}
              condition={product.condition}
              sourceProductId={product.id}
            />

            {/* Notify me — broader category-level opt-in for warm leads */}
            <NotifyMeForm
              categoryId={product.categoryId}
              sizes={product.sizes}
              brand={product.brand}
              categoryName={product.category.name}
            />
          </div>
        </div>

        {/* Smart similar products — scored by size/price/brand match — streams independently */}
        <Suspense fallback={<RelatedProductsSkeleton />}>
          <RelatedProductsSection
            productId={product.id}
            categoryId={product.categoryId}
            sold={true}
            productSizes={product.sizes}
            productPrice={product.price}
            productBrand={product.brand}
          />
        </Suspense>
      </div>
    );
  }

  // --- REGULAR PRODUCT VIEW ---
  const trackData = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    compareAt: product.compareAt,
    images: product.images,
    categoryName: product.category.name,
    brand: product.brand,
    condition: product.condition,
  };

  // Reservation status is computed client-side (in AddToCartButton) to avoid
  // cookies() call which would force this page to be fully dynamic (no ISR cache).
  // products-cache pre-serializes Dates to ISO strings for JSON round-trip via Redis.
  const reservedUntilIso = product.reservedUntil ?? null;

  let sizes: string[] = [];
  let colors: string[] = [];
  try { sizes = JSON.parse(product.sizes); } catch { /* corrupted data fallback */ }
  try { colors = JSON.parse(product.colors); } catch { /* corrupted data fallback */ }
  // Filter sentinel "no real size" values — they don't help the buyer.
  const SIZE_SENTINELS = new Set(["Jiná", "Jina", "Univerzální", "Univerzalni", "UNI"]);
  const filteredSizes = sizes.filter((s) => !SIZE_SENTINELS.has(s));
  // Accessories + all-sentinel cases: no size block at all.
  const NON_SIZED_CATEGORIES = new Set(["doplnky"]);
  const showSize =
    !NON_SIZED_CATEGORIES.has(product.category.slug) && filteredSizes.length > 0;
  const hasDiscount = product.compareAt && product.compareAt > product.price;
  const lowestPrice30d = product.lowestPrice30d;

  // Parse parenthetical variant info out of the title, e.g.
  // "TrueLife vyhřívací deka – 75 × 150 cm (málo používaná)" →
  // base: "TrueLife vyhřívací deka – 75 × 150 cm", variant: "málo používaná"
  const titleMatch = product.name.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const titleBase = titleMatch ? titleMatch[1] : product.name;
  const titleVariant = titleMatch ? titleMatch[2] : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {heroPreload && (
        <link
          rel="preload"
          as="image"
          href={heroPreload.src}
          imageSrcSet={heroPreload.srcSet}
          imageSizes={heroPreload.sizes}
          fetchPriority="high"
        />
      )}
      <TrackProductView product={trackData} />
      <BrowseAbandonmentTracker
        productId={product.id}
        productSlug={product.slug}
        productName={product.name}
        productImage={productImages[0]?.url}
        productPrice={product.price}
        productBrand={product.brand}
        productSize={sizes[0] ?? null}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }}
      />
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(videoJsonLd) }}
        />
      )}
      {/* Breadcrumb */}
      <nav className="mb-6 flex min-w-0 flex-wrap items-center gap-y-1 text-sm text-muted-foreground">
        <Link href="/products" className="shrink-0 transition-colors duration-150 hover:text-foreground">
          Katalog
        </Link>
        <span className="mx-2 shrink-0">/</span>
        <Link
          href={`/products?category=${product.category.slug}`}
          className="shrink-0 transition-colors duration-150 hover:text-foreground"
        >
          {product.category.name}
        </Link>
        <span className="mx-2 shrink-0">/</span>
        <span className="min-w-0 truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid min-w-0 gap-8 overflow-hidden lg:grid-cols-2 lg:gap-12">
        {/* Image Gallery */}
        <div className="min-w-0 overflow-hidden">
          <ProductGallery images={productImages} productName={product.name} videoUrl={product.videoUrl} />
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{product.category.name}</span>
            {product.brand && (
              <>
                <span className="text-muted-foreground/50">&middot;</span>
                <span className="font-medium">{product.brand}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 max-w-[28ch] text-balance font-heading text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl lg:text-[1.75rem]">
            {titleBase}
          </h1>
          {titleVariant && (
            <p className="mt-2 text-sm text-muted-foreground">{titleVariant}</p>
          )}

          {/* Condition + Price */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-2xl font-bold text-foreground">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-base text-muted-foreground line-through">
                {formatPrice(product.compareAt!)}
              </span>
            )}
            {hasDiscount && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-sm font-semibold text-destructive">
                -{Math.round(((product.compareAt! - product.price) / product.compareAt!) * 100)} %
              </span>
            )}
          </div>
          {hasDiscount && lowestPrice30d != null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Nejnižší cena za posledních 30 dní: {formatPrice(lowestPrice30d)}
            </p>
          )}

          {/* Sustainability savings callout */}
          {hasDiscount && (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-sage-dark/15 bg-sage-light px-3.5 py-2.5">
              <Leaf className="size-4 shrink-0 text-sage-dark" />
              <div>
                <p className="text-sm font-medium text-charcoal">
                  Ušetříte {formatPrice(product.compareAt! - product.price)} oproti nové ceně
                </p>
                <p className="text-xs text-sage-dark/70">
                  Udržitelná volba — dáváte oblečení druhý život
                </p>
              </div>
            </div>
          )}

          {/* Condition + uniqueness badges — scarcity shown up front */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${CONDITION_COLORS[product.condition] ?? "bg-muted text-muted-foreground"}`}
            >
              {CONDITION_LABELS[product.condition] ?? product.condition}
            </span>
            {product.stock > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-dark">
                <Sparkles className="size-3" />
                Jediný kus
              </span>
            )}
          </div>

          {/* Description */}
          <ProductDescription text={product.description} />

          {/* Fit note */}
          {product.fitNote && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.035] px-3.5 py-2.5">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary/60" />
              <p className="text-sm italic leading-relaxed text-foreground/75">
                {product.fitNote}
              </p>
            </div>
          )}

          {/* Measurements table */}
          {hasMeasurements(measurements) && (() => {
            const measurementCount = [measurements.chest, measurements.waist, measurements.hips, measurements.length, measurements.sleeve, measurements.inseam, measurements.shoulders].filter(Boolean).length;
            const gridCols =
              measurementCount === 1 ? "grid-cols-1" :
              measurementCount === 2 ? "grid-cols-2" :
              measurementCount === 3 ? "grid-cols-3" :
              measurementCount === 4 ? "grid-cols-2 sm:grid-cols-4" :
              measurementCount === 5 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" :
              "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";
            return (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                <Ruler className="size-4 shrink-0 text-foreground/60" />
                <span className="text-xs font-semibold tracking-wider text-foreground">Rozměry kusu</span>
                <span className="text-xs text-muted-foreground/40" aria-hidden="true">·</span>
                <MeasurementGuide />
                <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">v cm · ploché položení</span>
              </div>
              <div className={`grid gap-px bg-border ${gridCols}`}>
                {measurements.chest && (
                  <div className="flex cursor-default flex-col gap-1 bg-background px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prsa</span>
                    <span className="text-lg font-bold tabular-nums leading-none text-foreground">
                      {measurements.chest}<span className="ml-1 text-[11px] font-normal text-muted-foreground">cm</span>
                    </span>
                  </div>
                )}
                {measurements.waist && (
                  <div className="flex cursor-default flex-col gap-1 bg-background px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pas</span>
                    <span className="text-lg font-bold tabular-nums leading-none text-foreground">
                      {measurements.waist}<span className="ml-1 text-[11px] font-normal text-muted-foreground">cm</span>
                    </span>
                  </div>
                )}
                {measurements.hips && (
                  <div className="flex cursor-default flex-col gap-1 bg-background px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Boky</span>
                    <span className="text-lg font-bold tabular-nums leading-none text-foreground">
                      {measurements.hips}<span className="ml-1 text-[11px] font-normal text-muted-foreground">cm</span>
                    </span>
                  </div>
                )}
                {measurements.length && (
                  <div className="flex cursor-default flex-col gap-1 bg-background px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Délka</span>
                    <span className="text-lg font-bold tabular-nums leading-none text-foreground">
                      {measurements.length}<span className="ml-1 text-[11px] font-normal text-muted-foreground">cm</span>
                    </span>
                  </div>
                )}
                {measurements.sleeve && (
                  <div className="flex cursor-default flex-col gap-1 bg-background px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Rukáv</span>
                    <span className="text-lg font-bold tabular-nums leading-none text-foreground">
                      {measurements.sleeve}<span className="ml-1 text-[11px] font-normal text-muted-foreground">cm</span>
                    </span>
                  </div>
                )}
                {measurements.inseam && (
                  <div className="flex cursor-default flex-col gap-1 bg-background px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
                    <span className="text-[11px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">Vnitř. nohavice</span>
                    <span className="text-lg font-bold tabular-nums leading-none text-foreground">
                      {measurements.inseam}<span className="ml-1 text-[11px] font-normal text-muted-foreground">cm</span>
                    </span>
                  </div>
                )}
                {measurements.shoulders && (
                  <div className="flex cursor-default flex-col gap-1 bg-background px-4 py-3 transition-colors duration-150 hover:bg-muted/50">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Ramena</span>
                    <span className="text-lg font-bold tabular-nums leading-none text-foreground">
                      {measurements.shoulders}<span className="ml-1 text-[11px] font-normal text-muted-foreground">cm</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* Social sharing + wishlist */}
          <div className="mt-4 flex items-center gap-3">
            <WishlistButton productId={product.id} variant="detail" />
            <ShareButtons
              url={`${BASE_URL}/products/${product.slug}`}
              title={product.name}
              description={product.description}
            />
          </div>

          {/* Add to cart — reservation status computed client-side */}
          <AddToCartButton
            product={{
              id: product.id,
              name: product.name,
              price: product.price,
              slug: product.slug,
              images: product.images,
              sizes: filteredSizes,
              colors,
              stock: product.stock,
              reservedUntil: reservedUntilIso,
            }}
            hideSize={!showSize}
          />

          {/* Estimated delivery */}
          {product.stock > 0 && (() => {
            const { from, to } = getEstimatedDelivery();
            return (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Truck className="size-3.5 shrink-0" />
                <span>
                  Objednáte dnes — doručíme{" "}
                  <span className="font-medium text-foreground">
                    {formatDeliveryDate(from)} – {formatDeliveryDate(to)}
                  </span>
                </span>
              </div>
            );
          })()}

          {/* Free shipping progress bar */}
          {product.stock > 0 && (
            <FreeShippingBar productPrice={product.price} />
          )}

          {/* Notify me — similar items opt-in for warm leads */}
          <NotifyMeForm
            categoryId={product.categoryId}
            sizes={product.sizes}
            brand={product.brand}
            categoryName={product.category.name}
          />

          {/* Defects / flaws — honest transparent disclosure (trust builder) */}
          <ProductDefects note={product.defectsNote} images={defectImages} condition={product.condition} />

          {/* Shipping, returns & quality guarantee info */}
          <ProductInfoAccordion />
        </div>
      </div>

      {/* Related products — streams independently */}
      <Suspense fallback={<RelatedProductsSkeleton />}>
        <RelatedProductsSection
          productId={product.id}
          categoryId={product.categoryId}
          sold={false}
          productSizes={product.sizes}
          productPrice={product.price}
          productBrand={product.brand}
        />
      </Suspense>

      {/* Recently viewed */}
      <RecentlyViewedSection excludeProductId={product.id} />

      {/* Bottom spacer — prevents sticky ATC bar (visible even on stock=0) from obscuring last content on mobile */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
