import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrandStripBentoProps {
  collageImages: (string | null)[];
}

export function BrandStripBento({ collageImages }: BrandStripBentoProps) {
  const imgs = collageImages.filter((u): u is string => Boolean(u)).slice(0, 3);

  return (
    <section
      aria-label="Janička — vítejte"
      className="relative overflow-hidden bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60"
    >
      {/* Decor: leaf corner */}
      <Image
        src="/decor/leaf.svg"
        alt=""
        aria-hidden="true"
        width={96}
        height={128}
        className="pointer-events-none absolute -left-2 -top-4 size-16 text-brand/30 sm:size-24"
      />

      {/* Soft brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 top-1/3 size-56 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-stack px-4 py-section sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-stack-lg lg:px-8">
        {/* LEFT: brand copy + CTAs */}
        <div className="order-1 lg:col-span-7 lg:order-1">
          <h1 className="sr-only">
            Janička — second hand &amp; vintage móda, značkové oblečení levně
          </h1>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-card/60 px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase backdrop-blur-sm">
            <Heart className="size-3" aria-hidden="true" />
            Česká rodinná second hand značka
          </span>

          <p className="mt-stack-sm font-heading italic text-3xl leading-tight text-charcoal sm:text-4xl lg:text-5xl">
            Každý kousek vybírám
            <span className="block text-brand">a&nbsp;fotím osobně.</span>
          </p>

          <p className="mt-stack-sm max-w-xl text-base leading-relaxed text-charcoal-light sm:text-lg">
            Žádný sklad, žádný algoritmus. Jen pár rukou a&nbsp;oko pro krásu —
            a&nbsp;kousky, které dostanou druhou šanci.
          </p>

          <div className="mt-stack flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              data-track="brand-strip-bento-primary"
              render={<Link href="/products" />}
            >
              Prohlédnout kolekci
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              data-track="brand-strip-bento-secondary"
              render={<Link href="/products?sale=true" />}
            >
              <Percent data-icon="inline-start" className="size-4" />
              Výprodej
            </Button>
          </div>
        </div>

        {/* RIGHT: 3-image tilted collage with grain overlay */}
        <div
          aria-hidden="true"
          className="relative order-2 max-h-[55vh] lg:col-span-5 lg:order-2"
        >
          <div className="relative mx-auto aspect-fashion w-full max-w-md sm:max-w-lg lg:max-w-none">
            {imgs[0] && (
              <div className="absolute left-[6%] top-[4%] w-[52%] -rotate-3 overflow-hidden rounded-card shadow-card-rest ring-1 ring-inset ring-black/[0.04]">
                <div className="relative aspect-portrait">
                  <Image
                    src={imgs[0]}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 240px"
                    className="object-cover"
                    priority
                    fetchPriority="high"
                  />
                  <Image
                    src="/decor/grain.svg"
                    alt=""
                    fill
                    sizes="240px"
                    className="pointer-events-none object-cover opacity-30 mix-blend-multiply"
                  />
                </div>
              </div>
            )}
            {imgs[1] && (
              <div className="absolute right-[4%] top-[14%] w-[46%] rotate-2 overflow-hidden rounded-card shadow-card-rest ring-1 ring-inset ring-black/[0.04]">
                <div className="relative aspect-portrait">
                  <Image
                    src={imgs[1]}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 45vw, 220px"
                    className="object-cover"
                  />
                  <Image
                    src="/decor/grain.svg"
                    alt=""
                    fill
                    sizes="220px"
                    className="pointer-events-none object-cover opacity-30 mix-blend-multiply"
                  />
                </div>
              </div>
            )}
            {imgs[2] && (
              <div className="absolute bottom-[2%] left-[18%] w-[50%] -rotate-1 overflow-hidden rounded-card shadow-card-rest ring-1 ring-inset ring-black/[0.04]">
                <div className="relative aspect-portrait">
                  <Image
                    src={imgs[2]}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 240px"
                    className="object-cover"
                  />
                  <Image
                    src="/decor/grain.svg"
                    alt=""
                    fill
                    sizes="240px"
                    className="pointer-events-none object-cover opacity-30 mix-blend-multiply"
                  />
                </div>
              </div>
            )}
            {/* Fallback when no images yet — keep tile non-empty */}
            {imgs.length === 0 && (
              <div className="flex h-full w-full items-center justify-center">
                <Image
                  src="/logo/logo-transparent.png"
                  alt="Janička"
                  width={400}
                  height={218}
                  className="h-auto w-44 opacity-70 drop-shadow-md sm:w-56"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
