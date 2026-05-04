import Link from "next/link";
import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { getLowestPrices30d } from "@/lib/price-history";
import { CategoryHero, CatalogHero } from "@/components/shop/category-hero";
import { buildBreadcrumbSchema, jsonLdString } from "@/lib/structured-data";
import { ProductsClient, type CatalogProduct } from "./products-client";
import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { parseProductImages } from "@/lib/images";

const BASE_URL = getSiteUrl();

interface SearchParams {
  category?: string;
  sort?: string;
  sale?: string;
  brand?: string | string[];
  size?: string | string[];
  condition?: string | string[];
  color?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  page?: string;
  view?: string;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;

  if (params.category) {
    const db = await getDb();
    const category = await db.category.findUnique({
      where: { slug: params.category },
      select: { name: true, description: true },
    });

    if (category) {
      const title = `${category.name} — Katalog`;
      const description =
        category.description ??
        `Prohlédněte si naši kolekci ${category.name.toLowerCase()}. Unikátní second hand kousky za zlomek ceny.`;
      const canonicalUrl = `${BASE_URL}/products?category=${params.category}`;

      return {
        title,
        description,
        alternates: { canonical: canonicalUrl },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          type: "website",
          siteName: "Janička",
          locale: "cs_CZ",
        },
      };
    }
  }

  return {
    title: "Katalog",
    description:
      "Prohlédněte si naši kolekci stylového oblečení pro moderní ženy. Unikátní second hand kousky za zlomek ceny.",
    alternates: { canonical: `${BASE_URL}/products` },
    openGraph: {
      title: "Katalog",
      description:
        "Prohlédněte si naši kolekci stylového oblečení pro moderní ženy. Unikátní second hand kousky za zlomek ceny.",
      url: `${BASE_URL}/products`,
      type: "website",
      siteName: "Janička",
      locale: "cs_CZ",
    },
  };
}

/**
 * Fetch the full active/unsold catalog once — cached under tag 'products'
 * so admin mutations still invalidate via `revalidateTag('products')`.
 * Also includes 30-day lowest prices (fake-discount compliance) so the
 * client can render without additional round-trips.
 */
async function getCachedCatalog(): Promise<{
  products: CatalogProduct[];
  categories: { slug: string; name: string }[];
}> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");

  const db = await getDb();
  const [categoriesRaw, productsRaw] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.product.findMany({
      where: { active: true, sold: false },
      include: {
        category: { select: { slug: true, name: true } },
        _count: { select: { wishlistedBy: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
  ]);

  const lowestPricesMap = await getLowestPrices30d(productsRaw.map((p) => p.id));

  const products: CatalogProduct[] = productsRaw.map((p) => {
    // Phase 7: parseProductImages rewrites legacy r2.dev URLs → /uploads when
    // IMAGE_STORAGE_BACKEND=local. Re-serialize as the legacy {url, alt}[] shape
    // (or string[] fallback if all alts are empty) so the client component's
    // existing parser keeps working.
    const parsed = parseProductImages(p.images).slice(0, 2);
    const allEmpty = parsed.every((img) => !img.alt && !img.caption);
    const trimmedImages = allEmpty
      ? JSON.stringify(parsed.map((img) => img.url))
      : JSON.stringify(parsed);
    const desc = p.description ?? "";
    const descSnippet = desc.length > 160 ? `${desc.slice(0, 157)}...` : desc;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: descSnippet,
      sku: p.sku,
      price: p.price,
      compareAt: p.compareAt,
      images: trimmedImages,
      sizes: p.sizes,
      colors: p.colors,
      brand: p.brand,
      condition: p.condition,
      stock: p.stock,
      featured: p.featured,
      sold: p.sold,
      createdAt: p.createdAt.toISOString(),
      categoryName: p.category.name,
      categorySlug: p.category.slug,
      lowestPrice30d: lowestPricesMap.get(p.id) ?? null,
      wishlistCount: p._count?.wishlistedBy ?? 0,
    };
  });

  const categories = categoriesRaw.map((c) => ({ slug: c.slug, name: c.name }));

  return { products, categories };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Cached catalog. Wrapped in try-catch for the same reason as the previous
  // impl — "use cache" uses a different CWD on local dev, which can trip
  // SQLite on cold starts.
  let catalog: { products: CatalogProduct[]; categories: { slug: string; name: string }[] };
  try {
    catalog = await getCachedCatalog();
  } catch {
    catalog = { products: [], categories: [] };
  }
  const { products, categories } = catalog;

  // Pre-compute the "active category" info for the hero + breadcrumb (server-side,
  // cheap — just a lookup in the already-loaded category list).
  const activeCategory = params.category
    ? categories.find((c) => c.slug === params.category) ?? null
    : null;
  const categoryName = activeCategory?.name ?? "Všechny produkty";

  // Total count used only for the hero badge — matches server logic (all
  // active/unsold in that category, before user-applied filters).
  const heroCount = params.category
    ? products.filter((p) => p.categorySlug === params.category).length
    : products.length;

  // For the hero image/description we need the full category row — fetch it
  // lightly (no "use cache" — rare branch). This preserves the previous UX
  // when a category is active.
  let activeCategoryFull:
    | {
        name: string;
        slug: string;
        description: string | null;
        image: string | null;
      }
    | null = null;
  if (activeCategory) {
    const db = await getDb();
    activeCategoryFull = await db.category.findUnique({
      where: { slug: activeCategory.slug },
      select: { name: true, slug: true, description: true, image: true },
    });
  }

  // Breadcrumb JSON-LD
  const breadcrumbItems = [{ name: "Katalog", url: "/products" }];
  if (params.category) {
    breadcrumbItems.push({
      name: categoryName,
      url: `/products?category=${params.category}`,
    });
  }
  const breadcrumbJsonLd = buildBreadcrumbSchema(breadcrumbItems);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }}
      />

      {/* Hero */}
      {activeCategoryFull ? (
        <CategoryHero
          name={activeCategoryFull.name}
          slug={activeCategoryFull.slug}
          description={activeCategoryFull.description}
          image={activeCategoryFull.image}
          productCount={heroCount}
        />
      ) : (
        <CatalogHero productCount={heroCount} />
      )}

      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Navigace">
        <Link
          href="/"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center transition-colors duration-150 hover:text-foreground"
        >
          Domů
        </Link>
        <span className="mx-2">/</span>
        {params.category ? (
          <>
            <Link
              href="/products"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center transition-colors duration-150 hover:text-foreground"
            >
              Katalog
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{categoryName}</span>
          </>
        ) : (
          <span className="text-foreground">Katalog</span>
        )}
      </nav>

      {/* Catalog (client-side filtering/sorting/pagination — no server round-trips) */}
      <ProductsClient
        products={products}
        categories={categories}
        initialParams={params as Record<string, string | string[] | undefined>}
        categoryName={categoryName}
      />
    </div>
  );
}
