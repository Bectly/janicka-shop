import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";

export const revalidate = 3600; // 1h — collection pages are relatively static
import { ProductCard } from "@/components/shop/product-card";
import { getLowestPrices30d } from "@/lib/price-history";
import { buildItemListSchema, buildBreadcrumbSchema, jsonLdString } from "@/lib/structured-data";
import type { Metadata } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

const getCollection = cache(async (slug: string) => {
  const db = await getDb();
  const now = new Date();
  return db.collection.findFirst({
    where: {
      slug,
      active: true,
      OR: [
        { startDate: null },
        { startDate: { lte: now } },
      ],
    },
  });
});

export async function generateStaticParams() {
  try {
    const db = await getDb();
    const collections = await db.collection.findMany({
      where: { active: true },
      select: { slug: true },
    });
    return collections.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "Kolekce nenalezena" };
  if (collection.endDate && collection.endDate < new Date()) return { title: "Kolekce nenalezena" };

  return {
    title: collection.title,
    description:
      collection.description ||
      `Prohlédněte si kolekci ${collection.title} — kurátorský výběr unikátních second hand kousků.`,
    alternates: { canonical: `${BASE_URL}/collections/${slug}` },
    openGraph: {
      title: collection.title,
      description:
        collection.description ||
        `Prohlédněte si kolekci ${collection.title} — kurátorský výběr unikátních second hand kousků.`,
      url: `${BASE_URL}/collections/${slug}`,
      type: "website",
      siteName: "Janička",
      locale: "cs_CZ",
      ...(collection.image ? { images: [collection.image] } : {}),
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  // Check endDate
  if (collection.endDate && collection.endDate < new Date()) notFound();

  // Parse product IDs and fetch products
  let productIds: string[] = [];
  try {
    productIds = JSON.parse(collection.productIds);
  } catch { /* */ }

  const db = await getDb();
  const products = productIds.length > 0
    ? await db.product.findMany({
        where: { id: { in: productIds }, active: true, sold: false },
        include: { category: { select: { name: true } } },
      })
    : [];

  // Maintain collection order
  const productMap = new Map(products.map((p) => [p.id, p]));
  const orderedProducts = productIds
    .map((id) => productMap.get(id))
    .filter(Boolean) as typeof products;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const lowestPricesMap = await getLowestPrices30d(
    orderedProducts.map((p) => p.id),
  );

  // JSON-LD
  const itemListJsonLd = buildItemListSchema(
    orderedProducts.map((p) => ({
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
    collection.title,
    `/collections/${slug}`,
  );
  const breadcrumbJsonLd = buildBreadcrumbSchema([
    { name: "Kolekce", url: "/collections" },
    { name: collection.title, url: `/collections/${slug}` },
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Navigace">
        <Link href="/" className="hover:text-foreground">
          Domů
        </Link>
        <span className="mx-2">/</span>
        <Link href="/collections" className="hover:text-foreground">
          Kolekce
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{collection.title}</span>
      </nav>

      {/* Collection header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          {collection.title}
        </h1>
        {collection.description && (
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {collection.description}
          </p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          {orderedProducts.length}{" "}
          {orderedProducts.length === 1
            ? "kousek"
            : orderedProducts.length >= 2 && orderedProducts.length <= 4
              ? "kousky"
              : "kousků"}
        </p>
      </div>

      {/* Product grid */}
      {orderedProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {orderedProducts.map((product) => (
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
              />
            ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="text-lg text-muted-foreground">
            V této kolekci momentálně nejsou žádné dostupné produkty.
          </p>
          <Link
            href="/products"
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Prohlédnout celý katalog
          </Link>
        </div>
      )}
    </div>
  );
}
