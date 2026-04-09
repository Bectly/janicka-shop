import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { ProductCard } from "@/components/shop/product-card";
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
import { FreeShippingBar } from "@/components/shop/free-shipping-bar";
import { NotifyMeForm } from "@/components/shop/notify-me-form";
import { BrowseAbandonmentTracker } from "@/components/shop/browse-abandonment-tracker";
import { Truck, Leaf, Ruler, Sparkles } from "lucide-react";
import { parseProductImages, parseMeasurements, hasMeasurements } from "@/lib/images";
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
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

async function getProduct(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(`product-${slug}`, "products");
  const db = await getDb();
  return db.product.findUnique({
    where: { slug, active: true },
    include: { category: true },
  });
}


interface Props {
  params: Promise<{ slug: string }>;
}

/** OG condition label for product meta */
const OG_CONDITION: Record<string, string> = {
  new_with_tags: "new",
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
  const ogDescription = `${priceText}${brandText} | ${condLabel}. ${product.description}`.slice(0, 200);

  // Multiple OG images for carousel previews (up to 4)
  const ogImages = structuredImages.slice(0, 4).map((img) => ({
    url: img.url,
    alt: img.alt || product.name,
    width: 800,
    height: 800,
  }));

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: `${BASE_URL}/products/${product.slug}`,
    },
    openGraph: {
      title: `${product.name} — ${priceText}`,
      description: ogDescription,
      url: `${BASE_URL}/products/${product.slug}`,
      type: "website",
      siteName: "Janička",
      locale: "cs_CZ",
      ...(ogImages.length > 0 && { images: ogImages }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} — ${priceText}`,
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
  await connection();
  const { slug } = await params;

  const product = await getProduct(slug);

  if (!product) notFound();

  const db = await getDb();
  // Fetch related products — smart matching for sold pages, simple for regular
  const relatedQuery = {
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
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

  const relatedProducts = product.sold
    ? await (async () => {
        // Sold page: fetch more candidates and score by size/price/brand similarity
        const candidates = await db.product.findMany({ ...relatedQuery, take: 20 });

        let soldSizes: string[] = [];
        try { soldSizes = JSON.parse(product.sizes); } catch { /* */ }

        const scored = candidates.map((p) => {
          let score = 0;
          // Size match is most important — customer likely needs same size
          try {
            const pSizes: string[] = JSON.parse(p.sizes);
            if (soldSizes.length > 0 && pSizes.some((s) => soldSizes.includes(s))) score += 10;
          } catch { /* */ }
          // Price proximity (within 200 CZK = full points, fades out)
          const priceDiff = Math.abs(p.price - product.price);
          score += Math.max(0, 5 - priceDiff / 100);
          // Same brand bonus
          if (p.brand && p.brand === product.brand) score += 3;
          return { product: p, score };
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 8).map((s) => s.product);
      })()
    : await db.product.findMany({ ...relatedQuery, take: 4 });

  const allIds = [product.id, ...relatedProducts.map((p) => p.id)];
  const lowestPricesMap = await getLowestPrices30d(allIds);

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
        "Každý kousek pečlivě kontrolujeme a fotografujeme. Stav je vždy přesně popsán — žádná nepříjemná překvapení. Na rozdíl od Vintedu u nás přesně víte, co kupujete.",
    },
  ]);

  const productImages = parseProductImages(product.images);
  const measurements = parseMeasurements(product.measurements);

  // --- SOLD PRODUCT VIEW ---
  if (product.sold) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/products" className="hover:text-foreground">
            Katalog
          </Link>
          <span className="mx-2">/</span>
          <Link
            href={`/products?category=${product.category.slug}`}
            className="hover:text-foreground"
          >
            {product.category.name}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Image — greyed out */}
          <div className="relative">
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
            <h1 className="mt-1 font-heading text-2xl font-bold text-foreground sm:text-3xl">
              {product.name}
            </h1>

            <div className="mt-6 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center">
              <p className="text-lg font-medium text-foreground">
                Tento kousek už má novou majitelku
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Každý náš kousek je unikát. Podívejte se na podobné kousky níže.
              </p>
              <Link
                href={`/products?category=${product.category.slug}`}
                className="mt-4 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Prohlédnout {product.category.name.toLowerCase()}
              </Link>
            </div>

            {/* Notify me — email capture for warm leads */}
            <NotifyMeForm
              categoryId={product.categoryId}
              sizes={product.sizes}
              brand={product.brand}
              categoryName={product.category.name}
            />
          </div>
        </div>

        {/* Smart similar products — scored by size/price/brand match */}
        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="font-heading text-xl font-bold text-foreground">
              Podobné dostupné kousky
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vybrali jsme kousky podobné velikosti, ceny a stylu
            </p>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
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
            </div>
          </section>
        )}
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
  const reservedUntilIso = product.reservedUntil?.toISOString() ?? null;

  let sizes: string[] = [];
  let colors: string[] = [];
  try { sizes = JSON.parse(product.sizes); } catch { /* corrupted data fallback */ }
  try { colors = JSON.parse(product.colors); } catch { /* corrupted data fallback */ }
  const hasDiscount = product.compareAt && product.compareAt > product.price;
  const lowestPrice30d = lowestPricesMap.get(product.id) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          Katalog
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/products?category=${product.category.slug}`}
          className="hover:text-foreground"
        >
          {product.category.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Image Gallery */}
        <ProductGallery images={productImages} productName={product.name} videoUrl={product.videoUrl} />

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
          <h1 className="mt-1 font-heading text-2xl font-bold text-foreground sm:text-3xl">
            {product.name}
          </h1>

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
              <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-sm font-semibold text-destructive">
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
            <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-950/30">
              <Leaf className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Ušetříte {formatPrice(product.compareAt! - product.price)} oproti nové ceně
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70">
                  Udržitelná volba — dáváte oblečení druhý život
                </p>
              </div>
            </div>
          )}

          {/* Condition badge */}
          <div className="mt-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${CONDITION_COLORS[product.condition] ?? "bg-muted text-muted-foreground"}`}
            >
              {CONDITION_LABELS[product.condition] ?? product.condition}
            </span>
          </div>

          {/* Description */}
          <p className="mt-5 leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          {/* Fit note */}
          {product.fitNote && (
            <p className="mt-3 text-sm italic text-muted-foreground">
              {product.fitNote}
            </p>
          )}

          {/* Measurements table */}
          {hasMeasurements(measurements) && (
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Ruler className="size-3.5" />
                Rozměry kusu
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4 sm:gap-x-6">
                {measurements.chest && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5">
                    <span className="text-muted-foreground">Prsa</span>
                    <span className="font-medium">{measurements.chest} cm</span>
                  </div>
                )}
                {measurements.waist && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5">
                    <span className="text-muted-foreground">Pas</span>
                    <span className="font-medium">{measurements.waist} cm</span>
                  </div>
                )}
                {measurements.hips && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5">
                    <span className="text-muted-foreground">Boky</span>
                    <span className="font-medium">{measurements.hips} cm</span>
                  </div>
                )}
                {measurements.length && (
                  <div className="flex justify-between sm:flex-col sm:gap-0.5">
                    <span className="text-muted-foreground">Délka</span>
                    <span className="font-medium">{measurements.length} cm</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
              sizes,
              colors,
              stock: product.stock,
              reservedUntil: reservedUntilIso,
            }}
          />

          {/* Stock info — delivery + shipping shown unconditionally;
              AddToCartButton handles the "reserved by other" state client-side */}
          {product.stock > 0 ? (
            <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Sparkles className="size-3.5" />
              Jediný kus — tento kousek existuje jen jednou
            </p>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Momentálně nedostupné
            </p>
          )}

          {/* Estimated delivery */}
          {product.stock > 0 && (() => {
            const { from, to } = getEstimatedDelivery();
            return (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
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

          {/* Shipping, returns & quality guarantee info */}
          <ProductInfoAccordion />
        </div>
      </div>

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <section className="mt-16">
          <h2 className="font-heading text-xl font-bold text-foreground">
            Mohlo by se vám líbit
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
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
          </div>
        </section>
      )}

      {/* Recently viewed */}
      <RecentlyViewedSection excludeProductId={product.id} />

      {/* Bottom spacer — prevents sticky ATC bar from obscuring related/recently viewed on mobile */}
      {product.stock > 0 && <div className="h-20 lg:hidden" />}
    </div>
  );
}
