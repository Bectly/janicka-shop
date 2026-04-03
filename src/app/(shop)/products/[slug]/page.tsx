import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { ProductCard } from "@/components/shop/product-card";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug, active: true, sold: false },
    select: { name: true, description: true },
  });

  if (!product) return {};

  return {
    title: product.name,
    description: product.description,
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug, active: true, sold: false },
    include: { category: true },
  });

  if (!product) notFound();

  const sizes: string[] = JSON.parse(product.sizes);
  const colors: string[] = JSON.parse(product.colors);
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
        {/* Image */}
        <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-muted">
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <span className="text-6xl text-muted-foreground/20">
              {product.name.charAt(0)}
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
            }}
          />

          {/* Stock info */}
          <p className="mt-4 text-xs text-muted-foreground">
            {product.sold
              ? "Tento kousek už má novou majitelku"
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
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
