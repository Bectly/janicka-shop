import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { ProductCard } from "@/components/shop/product-card";
import { ProductGallery } from "@/components/shop/product-gallery";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { getVisitorId } from "@/lib/visitor";
import { getLowestPrices30d } from "@/lib/price-history";
import { buildProductSchema, jsonLdString } from "@/lib/structured-data";
import { ShareButtons } from "@/components/shop/share-buttons";
import { WishlistButton } from "@/components/shop/wishlist-button";
import {
  TrackProductView,
  RecentlyViewedSection,
} from "@/components/shop/recently-viewed";
import { ProductInfoAccordion } from "@/components/shop/product-info-accordion";
import type { Metadata } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

const getProduct = cache(async (slug: string) => {
  return prisma.product.findUnique({
    where: { slug, active: true },
    include: { category: true },
  });
});

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  let images: string[] = [];
  try { images = JSON.parse(product.images); } catch { /* fallback */ }

  return {
    title: product.name,
    description: product.description,
    alternates: {
      canonical: `${BASE_URL}/products/${product.slug}`,
    },
    openGraph: {
      title: product.name,
      description: product.description,
      url: `${BASE_URL}/products/${product.slug}`,
      type: "website",
      siteName: "Janička",
      locale: "cs_CZ",
      ...(images.length > 0 && { images: [{ url: images[0], alt: product.name }] }),
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  const product = await getProduct(slug);

  if (!product) notFound();

  // Fetch related products (always useful — for sold page and regular page)
  const relatedProducts = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      active: true,
      sold: false,
    },
    include: { category: { select: { name: true } } },
    take: 4,
  });

  const allIds = [product.id, ...relatedProducts.map((p) => p.id)];
  const lowestPricesMap = await getLowestPrices30d(allIds);

  // JSON-LD structured data for SEO (Google Shopping + AI search visibility)
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
      sold: product.sold,
      categoryName: product.category.name,
    }),
  };

  let productImages: string[] = [];
  try { productImages = JSON.parse(product.images); } catch { /* corrupted data fallback */ }

  // --- SOLD PRODUCT VIEW ---
  if (product.sold) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
        />
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
              <ProductGallery images={productImages} productName={product.name} />
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
          </div>
        </div>

        {/* Related products */}
        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="font-heading text-xl font-bold text-foreground">
              Podobné kousky, které jsou ještě dostupné
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

  const visitorId = await getVisitorId();
  const now = new Date();
  const isReservedByOther =
    !!product.reservedUntil &&
    product.reservedUntil > now &&
    product.reservedBy !== visitorId;

  let sizes: string[] = [];
  let colors: string[] = [];
  try { sizes = JSON.parse(product.sizes); } catch { /* corrupted data fallback */ }
  try { colors = JSON.parse(product.colors); } catch { /* corrupted data fallback */ }
  const hasDiscount = product.compareAt && product.compareAt > product.price;
  const lowestPrice30d = lowestPricesMap.get(product.id) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <TrackProductView product={trackData} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
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
        <ProductGallery images={productImages} productName={product.name} />

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

          {/* Social sharing + wishlist */}
          <div className="mt-4 flex items-center gap-3">
            <WishlistButton productId={product.id} variant="detail" />
            <ShareButtons
              url={`${BASE_URL}/products/${product.slug}`}
              title={product.name}
              description={product.description}
            />
          </div>

          {/* Add to cart */}
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
              reservedByOther: isReservedByOther,
            }}
          />

          {/* Stock info */}
          <p className="mt-4 text-xs text-muted-foreground">
            {isReservedByOther
              ? "Tento kousek si právě někdo prohlíží"
              : product.stock > 0
                ? "Poslední kus — unikátní kousek"
                : "Momentálně nedostupné"}
          </p>

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
                lowestPrice30d={lowestPricesMap.get(p.id) ?? null}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recently viewed */}
      <RecentlyViewedSection excludeProductId={product.id} />
    </div>
  );
}
