"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import {
  Sparkles,
  Shirt,
  Layers,
  Wind,
  Gem,
  Footprints,
  Tag,
  type LucideIcon,
} from "lucide-react";

interface CategoryHeroProps {
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  productCount: number;
}

/**
 * Category-specific mood — each category gets a unique editorial
 * color story, tagline, and decorative watermark letter.
 */
const CATEGORY_MOODS: Record<
  string,
  {
    gradient: string;
    accent: string;
    icon: LucideIcon;
    tagline: string;
    watermark: string;
  }
> = {
  saty: {
    gradient: "from-brand/15 via-champagne-light/60 to-blush",
    accent: "text-brand-dark",
    icon: Sparkles,
    tagline: "Elegance, která vypráví příběh",
    watermark: "Š",
  },
  "topy-halenky": {
    gradient: "from-sage-light/80 via-champagne-light/40 to-blush-light",
    accent: "text-sage-dark",
    icon: Shirt,
    tagline: "Každodenní styl, výjimečný výběr",
    watermark: "T",
  },
  "kalhoty-sukne": {
    gradient: "from-champagne/40 via-blush-light/60 to-brand-light/20",
    accent: "text-charcoal",
    icon: Layers,
    tagline: "Základ šatníku, který vydrží",
    watermark: "K",
  },
  "bundy-kabaty": {
    gradient: "from-charcoal/10 via-champagne-light/50 to-sage-light/30",
    accent: "text-charcoal-dark",
    icon: Wind,
    tagline: "Pro každé počasí, s osobitým stylem",
    watermark: "B",
  },
  boty: {
    gradient: "from-blush-light/60 via-champagne-light/40 to-blush",
    accent: "text-brand-dark",
    icon: Footprints,
    tagline: "Každý pár vyprávějící svůj příběh",
    watermark: "B",
  },
  doplnky: {
    gradient: "from-champagne/60 via-brand-light/20 to-blush-light",
    accent: "text-champagne-dark",
    icon: Gem,
    tagline: "Detaily, které dělají outfit",
    watermark: "D",
  },
};

const DEFAULT_MOOD = {
  gradient: "from-brand-light/20 via-champagne-light/50 to-blush",
  accent: "text-brand-dark",
  icon: Sparkles,
  tagline: "Unikátní kousky, pečlivě vybrané",
  watermark: "J",
};

function useParallax(factor = 0.3) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    let ticking = false;
    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setOffset(window.scrollY * factor);
          ticking = false;
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [factor]);

  return offset;
}

function productCountText(count: number): string {
  if (count === 1) return "unikátní kousek";
  if (count >= 2 && count <= 4) return "unikátní kousky";
  return "unikátních kousků";
}

export function CategoryHero({
  name,
  slug,
  description,
  image,
  productCount,
}: CategoryHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const offset = useParallax(0.3);
  const mood = CATEGORY_MOODS[slug] ?? DEFAULT_MOOD;

  return (
    <div
      ref={heroRef}
      className="category-hero relative -mx-4 -mt-8 mb-10 overflow-hidden sm:-mx-6 lg:-mx-8"
    >
      {/* Background layer with parallax */}
      <div
        className="absolute inset-0 will-change-transform"
        style={{ transform: `translateY(${offset}px)` }}
      >
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
            quality={85}
          />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${mood.gradient}`}
          />
        )}
        {/* Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
      </div>

      {/* Decorative watermark letter */}
      <div
        className="pointer-events-none absolute right-4 top-6 select-none font-heading text-[12rem] font-bold leading-none text-foreground/[0.03] sm:right-8 sm:text-[16rem] lg:right-16 lg:text-[20rem]"
        aria-hidden="true"
      >
        {mood.watermark}
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-24 lg:px-8 lg:pb-20 lg:pt-32">
        {/* Editorial pill badge — stagger 1 */}
        <span className="category-hero-stagger mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <mood.icon className="size-3.5 shrink-0" aria-hidden="true" />
          Kolekce
        </span>

        {/* Heading — stagger 2 */}
        <h1
          className={`category-hero-stagger [animation-delay:80ms] text-display ${mood.accent}`}
        >
          {name}
        </h1>

        {/* Decorative brand accent line — stagger 3 */}
        <div
          className="category-hero-stagger [animation-delay:160ms] mt-4 h-[3px] w-12 rounded-full bg-gradient-to-r from-brand to-brand-light"
          aria-hidden="true"
        />

        {/* Editorial tagline — stagger 4 */}
        <p
          className="category-hero-stagger [animation-delay:220ms] mt-4 font-heading text-lg italic text-muted-foreground/70 sm:text-xl"
        >
          {mood.tagline}
        </p>

        {/* Description — stagger 5 */}
        {description && (
          <p
            className="category-hero-stagger [animation-delay:280ms] mt-3 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            {description}
          </p>
        )}

        {/* Count — stagger 6 */}
        <p
          className="category-hero-stagger [animation-delay:340ms] mt-4 text-sm font-medium text-muted-foreground/80"
        >
          {productCount} {productCountText(productCount)}
        </p>
      </div>

      {/* Bottom fade edge for seamless transition into content */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

/**
 * Generic catalog hero — shown when no category is selected.
 */
export function CatalogHero({ productCount }: { productCount: number }) {
  const offset = useParallax(0.3);

  return (
    <div className="category-hero relative -mx-4 -mt-8 mb-10 overflow-hidden sm:-mx-6 lg:-mx-8">
      <div
        className="absolute inset-0 will-change-transform"
        style={{ transform: `translateY(${offset}px)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-light/20 via-champagne-light/40 to-blush" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
      </div>

      {/* Decorative watermark */}
      <div
        className="pointer-events-none absolute right-4 top-6 select-none font-heading text-[12rem] font-bold leading-none text-foreground/[0.03] sm:right-8 sm:text-[16rem] lg:right-16 lg:text-[20rem]"
        aria-hidden="true"
      >
        J
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-24 lg:px-8 lg:pb-20 lg:pt-32">
        {/* Editorial pill badge */}
        <span className="category-hero-stagger mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <Tag className="size-3.5 shrink-0" aria-hidden="true" />
          Naše kolekce
        </span>

        <h1
          className="category-hero-stagger [animation-delay:80ms] text-display text-foreground"
        >
          Katalog
        </h1>

        {/* Decorative accent line */}
        <div
          className="category-hero-stagger [animation-delay:160ms] mt-4 h-[3px] w-12 rounded-full bg-gradient-to-r from-brand to-brand-light"
          aria-hidden="true"
        />

        <p
          className="category-hero-stagger [animation-delay:220ms] mt-4 font-heading text-lg italic text-muted-foreground/70 sm:text-xl"
        >
          Pečlivě vybraný second hand pro moderní ženy
        </p>

        <p
          className="category-hero-stagger [animation-delay:280ms] mt-3 max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Prohlédněte si naši kolekci stylového oblečení. Každý kousek je
          unikát — pečlivě vybraný a zkontrolovaný.
        </p>

        <p
          className="category-hero-stagger [animation-delay:340ms] mt-4 text-sm font-medium text-muted-foreground/80"
        >
          {productCount}{" "}
          {productCount === 1
            ? "kousek"
            : productCount >= 2 && productCount <= 4
              ? "kousky"
              : "kousků"}{" "}
          v nabídce
        </p>
      </div>

      {/* Bottom fade edge */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
