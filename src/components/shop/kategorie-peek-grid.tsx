import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";
import { getImageUrls } from "@/lib/images";

type CategoryWithImage = {
  id: string;
  name: string;
  slug: string;
  count: number;
  imageUrl: string | null;
};

async function getCategoriesWithCovers(): Promise<CategoryWithImage[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  try {
    const db = await getDb();
    const categories = await db.category.findMany({
      orderBy: { sortOrder: "asc" },
      take: 4,
      include: {
        _count: {
          select: { products: { where: { active: true, sold: false } } },
        },
        products: {
          where: { active: true, sold: false },
          select: { images: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c._count.products,
      imageUrl: c.products[0] ? (getImageUrls(c.products[0].images)[0] ?? null) : null,
    }));
  } catch {
    return [];
  }
}

export async function KategoriePeekGrid() {
  const categories = await getCategoriesWithCovers();
  if (categories.length === 0) return null;

  const [tall, ...rest] = categories;

  return (
    <section
      aria-labelledby="kategorie-peek-heading"
      className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8"
    >
      <div className="mb-stack flex flex-col items-center text-center">
        <Image
          src="/decor/dotted-divider.svg"
          alt=""
          aria-hidden="true"
          width={48}
          height={8}
          className="h-2 w-12 text-brand/30"
        />
        <span className="mt-stack-xs inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.25em] text-brand uppercase">
          02 / Kategorie
        </span>
        <h2
          id="kategorie-peek-heading"
          className="section-heading mt-stack-xs font-heading text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl"
        >
          Najděte svůj kousek
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-stack-sm lg:grid-cols-4 lg:grid-rows-2">
        {/* Tall hero tile */}
        {tall && (
          <Link
            href={`/products?category=${tall.slug}`}
            data-track="kategorie-peek-tall"
            className="group relative col-span-2 overflow-hidden rounded-card bg-blush ring-1 ring-inset ring-border/50 transition-shadow hover:shadow-card-hover lg:col-span-2 lg:row-span-2"
          >
            <div className="relative aspect-fashion lg:aspect-auto lg:h-full">
              {tall.imageUrl ? (
                <Image
                  src={tall.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blush via-card to-champagne-light/60">
                  <Image
                    src="/logo/logo-transparent.png"
                    alt=""
                    width={240}
                    height={130}
                    className="h-auto w-1/2 opacity-60"
                  />
                </div>
              )}
              {/* Grain overlay */}
              <Image
                src="/decor/grain.svg"
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="pointer-events-none object-cover opacity-30 mix-blend-overlay"
              />
              {/* Leaf corner accent */}
              <Image
                src="/decor/leaf.svg"
                alt=""
                aria-hidden="true"
                width={48}
                height={64}
                className="pointer-events-none absolute left-3 top-3 size-12 text-sage/40"
              />
              {/* Bottom gradient + label */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-stack-sm sm:p-stack">
                <div>
                  <p className="font-heading text-xl text-card sm:text-2xl lg:text-3xl">
                    {tall.name}
                  </p>
                  <p className="text-xs text-card/80 sm:text-sm">
                    {tall.count} kousků
                  </p>
                </div>
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-card/90 text-charcoal transition-colors group-hover:bg-card">
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* Standard tiles */}
        {rest.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            data-track="kategorie-peek-standard"
            className="group relative overflow-hidden rounded-card bg-blush ring-1 ring-inset ring-border/50 transition-shadow hover:shadow-card-hover"
          >
            <div className="relative aspect-fashion">
              {cat.imageUrl ? (
                <Image
                  src={cat.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card to-blush-light">
                  <span className="font-heading text-lg text-charcoal/50">
                    {cat.name}
                  </span>
                </div>
              )}
              <Image
                src="/decor/grain.svg"
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="pointer-events-none object-cover opacity-25 mix-blend-overlay"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-charcoal/70 via-charcoal/15 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-stack-sm">
                <div>
                  <p className="font-heading text-base text-card sm:text-lg">
                    {cat.name}
                  </p>
                  <p className="text-xs text-card/80">{cat.count} kousků</p>
                </div>
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-card/85 text-charcoal transition-colors group-hover:bg-card">
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-stack text-center">
        <Link
          href="/products"
          data-track="kategorie-peek-cta-all"
          className="inline-flex h-11 items-center gap-1 px-3 text-sm font-medium text-primary hover:underline"
        >
          Prohlédnout všechny <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
