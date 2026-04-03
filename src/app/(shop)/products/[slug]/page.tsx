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
import type { Metadata } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

const getProduct = cache(async (slug: string) => {
  return prisma.product.findUnique({
    where: { slug, active: true, sold: false },
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

  // Check if reserved by another visitor
  const visitorId = await getVisitorId();
  const now = new Date();
  const isReservedByOther =
    !!product.reservedUntil &&
    product.reservedUntil > now &&
    product.reservedBy !== visitorId;

  let sizes: string[] = [];
  let colors: string[] = [];
  let productImages: string[] = [];
  try { sizes = JSON.parse(product.sizes); } catch { /* corrupted data fallback */ }
  try { colors = JSON.parse(product.colors); } catch { /* corrupted data fallback */ }
  try { productImages = JSON.parse(product.images); } catch { /* corrupted data fallback */ }
  const hasDiscount = product.compareAt && product.compareAt > product.price;

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
  const lowestPrice30d = lowestPricesMap.get(product.id) ?? null;

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
            {product.sold
              ? "Tento kousek už má novou majitelku"
              : isReservedByOther
                ? "Tento kousek si právě někdo prohlíží"
                : product.stock > 0
                  ? "Poslední kus — unikátní kousek"
                  : "Momentálně nedostupné"}
          </p>
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
