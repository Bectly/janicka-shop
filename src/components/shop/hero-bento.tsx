import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImageUrls } from "@/lib/images";

type ProductLike = {
  id: string;
  slug: string;
  name: string;
  images: string;
};

type CategoryLike = {
  id: string;
  name: string;
  slug: string;
};

interface HeroBentoProps {
  editorialImageUrl?: string | null;
  janickaSelfieUrl?: string | null;
  newProducts: ProductLike[];
  categories: CategoryLike[];
}

export function HeroBento({
  editorialImageUrl,
  janickaSelfieUrl,
  newProducts,
  categories,
}: HeroBentoProps) {
  const heroImg = editorialImageUrl ?? null;
  // TODO: when Bolt #20632 lands getJanickaSelfieUrl(), wire it here.
  // For now, fall back to editorialImageUrl per spec section 4.6.
  const selfieImg = janickaSelfieUrl ?? editorialImageUrl ?? null;

  const peekProducts = newProducts.slice(0, 3);
  const catTiles = categories.slice(0, 4);

  return (
    <section
      aria-label="Janička — vítejte"
      className="mx-auto max-w-7xl px-4 pt-6 pb-section sm:px-6 lg:px-8"
    >
      <h1 className="sr-only">
        Janička — second hand &amp; vintage móda, značkové oblečení levně
      </h1>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-6 lg:auto-rows-fr lg:gap-5">
        {/* ─── Tile A — Brand statement ─────────────────────── */}
        <article className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60 ring-1 ring-inset ring-black/[0.04] aspect-fashion lg:col-span-3 lg:row-span-2 lg:aspect-auto">
          {heroImg && (
            <Image
              src={heroImg}
              alt=""
              fill
              priority
              fetchPriority="high"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover opacity-60 mix-blend-multiply transition-transform duration-700 group-hover:scale-[1.02]"
            />
          )}

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-12 -top-12 size-48 rounded-full bg-brand/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-12 size-56 rounded-full bg-champagne/30 blur-3xl"
          />

          <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6 py-10 text-center sm:px-10 sm:py-14">
            <Image
              src="/logo/logo-transparent.png"
              alt="Janička"
              width={400}
              height={218}
              priority
              fetchPriority="high"
              className="h-auto w-[140px] drop-shadow-lg sm:w-[180px] lg:w-[210px]"
            />

            <p className="max-w-md font-heading italic text-xl leading-snug text-charcoal sm:text-2xl lg:text-3xl">
              Každý kousek vybírám a&nbsp;fotím osobně.
            </p>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-card/70 px-4 py-1 backdrop-blur-sm">
              <Heart className="size-3 text-brand" aria-hidden="true" />
              <span className="text-sm font-medium text-brand/80">
                Česká rodinná second hand značka
              </span>
            </span>

            <Button
              size="lg"
              data-track="hero-bento-tile-a-cta"
              render={<Link href="/products" />}
            >
              Prohlédnout kolekci
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
          </div>
        </article>

        {/* ─── Tile B — Janičin moment ─────────────────────── */}
        <article className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blush via-card to-blush-light ring-1 ring-inset ring-black/[0.04] aspect-[16/10] lg:col-span-3 lg:row-span-1 lg:aspect-portrait">
          {selfieImg ? (
            <Image
              src={selfieImg}
              alt="Janička při výběru kousků"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/logo/logo-transparent.png"
                alt=""
                width={320}
                height={174}
                className="h-auto w-[160px] opacity-60 sm:w-[200px]"
              />
            </div>
          )}

          {/* Bottom gradient for text legibility over photo */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-charcoal/70 via-charcoal/30 to-transparent"
          />

          <div className="relative flex h-full flex-col justify-end gap-2 p-6 sm:p-8">
            <p className="max-w-sm font-heading italic text-lg leading-snug text-card sm:text-xl">
              Žádný sklad. Jen pár rukou a&nbsp;oko pro krásu.
            </p>
            <Link
              href="/about"
              data-track="hero-bento-tile-b-link"
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-card/90 underline-offset-4 hover:underline"
            >
              Janičin příběh
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </article>

        {/* ─── Tile C — Nově přidané peek ─────────────────────── */}
        <article className="relative overflow-hidden rounded-3xl bg-card ring-1 ring-inset ring-border/60 aspect-square lg:col-span-3 lg:row-span-1 lg:aspect-auto">
          <div className="flex h-full flex-col gap-4 p-6 sm:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase">
                  <span
                    className="size-1.5 rounded-full bg-brand animate-pulse"
                    aria-hidden="true"
                  />
                  Nové
                </span>
                <p className="mt-2 font-heading text-xl text-foreground sm:text-2xl">
                  Nově přidané
                </p>
              </div>
              <Link
                href="/products?sort=newest"
                data-track="hero-bento-tile-c-link"
                className="hidden whitespace-nowrap text-sm font-medium text-primary hover:underline sm:inline"
              >
                Prohlédnout vše →
              </Link>
            </div>

            {peekProducts.length > 0 ? (
              <div className="grid flex-1 grid-cols-3 gap-2 sm:gap-3">
                {peekProducts.map((product) => {
                  const url = getImageUrls(product.images)[0] ?? null;
                  return (
                    <Link
                      key={product.id}
                      href={`/products/${product.slug}`}
                      className="group relative overflow-hidden rounded-2xl bg-blush-light ring-1 ring-inset ring-border/40 aspect-square transition-shadow hover:shadow-md"
                      aria-label={product.name}
                    >
                      {url && (
                        <Image
                          src={url}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 33vw, 200px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Brzy přidáme nové kousky.
              </div>
            )}

            <Link
              href="/products?sort=newest"
              data-track="hero-bento-tile-c-link-mobile"
              className="text-sm font-medium text-primary hover:underline sm:hidden"
            >
              Prohlédnout vše →
            </Link>
          </div>
        </article>

        {/* ─── Tile D — Category strip ─────────────────────── */}
        {catTiles.length > 0 && (
          <nav
            aria-label="Hlavní kategorie"
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:col-span-6"
          >
            {catTiles.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                data-track="hero-bento-tile-d-link"
                className="group flex items-center justify-center rounded-2xl border border-border/60 bg-gradient-to-br from-card to-blush-light px-4 py-4 text-center text-sm font-medium text-foreground/80 transition-all hover:border-brand/30 hover:from-blush hover:to-brand-light/20 hover:text-primary hover:shadow-sm sm:py-5"
              >
                <span className="font-heading">{cat.name}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </section>
  );
}
