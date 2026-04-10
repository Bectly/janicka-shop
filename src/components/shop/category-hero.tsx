"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles, Shirt, Layers, Wind, Gem, Tag, type LucideIcon } from "lucide-react";

interface CategoryHeroProps {
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  productCount: number;
}

/**
 * Category-specific mood gradients — each category gets a unique
 * editorial color story using the brand palette (OKLch).
 */
const CATEGORY_MOODS: Record<
  string,
  { gradient: string; accent: string; icon: LucideIcon }
> = {
  saty: {
    gradient:
      "from-brand/15 via-champagne-light/60 to-blush",
    accent: "text-brand-dark",
    icon: Sparkles,
  },
  "topy-halenky": {
    gradient:
      "from-sage-light/80 via-champagne-light/40 to-blush-light",
    accent: "text-sage-dark",
    icon: Shirt,
  },
  "kalhoty-sukne": {
    gradient:
      "from-champagne/40 via-blush-light/60 to-brand-light/20",
    accent: "text-charcoal",
    icon: Layers,
  },
  "bundy-kabaty": {
    gradient:
      "from-charcoal/10 via-champagne-light/50 to-sage-light/30",
    accent: "text-charcoal-dark",
    icon: Wind,
  },
  doplnky: {
    gradient:
      "from-champagne/60 via-brand-light/20 to-blush-light",
    accent: "text-champagne-dark",
    icon: Gem,
  },
};

const DEFAULT_MOOD = {
  gradient: "from-brand-light/20 via-champagne-light/50 to-blush",
  accent: "text-brand-dark",
  icon: Sparkles,
};

export function CategoryHero({
  name,
  slug,
  description,
  image,
  productCount,
}: CategoryHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
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
          setOffset(window.scrollY * 0.3);
          ticking = false;
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const mood = CATEGORY_MOODS[slug] ?? DEFAULT_MOOD;

  return (
    <div
      ref={heroRef}
      className="relative -mx-4 -mt-8 mb-8 overflow-hidden sm:-mx-6 lg:-mx-8"
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
          />
        ) : (
          /* Gradient mood fallback */
          <div
            className={`absolute inset-0 bg-gradient-to-br ${mood.gradient}`}
          />
        )}
        {/* Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20 lg:px-8 lg:pb-14 lg:pt-24">
        {/* Editorial pill badge */}
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <mood.icon className="size-3.5 shrink-0" aria-hidden="true" />
          Kolekce
        </span>

        <h1
          className={`mt-1 font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl ${mood.accent}`}
        >
          {name}
        </h1>

        {description && (
          <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
            {description}
          </p>
        )}

        <p className="mt-3 text-sm font-medium text-muted-foreground/80">
          {productCount}{" "}
          {productCount === 1
            ? "unikátní kousek"
            : productCount >= 2 && productCount <= 4
              ? "unikátní kousky"
              : "unikátních kousků"}
        </p>
      </div>
    </div>
  );
}

/**
 * Generic catalog hero — shown when no category is selected.
 */
export function CatalogHero({ productCount }: { productCount: number }) {
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
          setOffset(window.scrollY * 0.3);
          ticking = false;
        });
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative -mx-4 -mt-8 mb-8 overflow-hidden sm:-mx-6 lg:-mx-8">
      <div
        className="absolute inset-0 will-change-transform"
        style={{ transform: `translateY(${offset}px)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-brand-light/20 via-champagne-light/40 to-blush" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20 lg:px-8 lg:pb-14 lg:pt-24">
        {/* Editorial pill badge */}
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <Tag className="size-3.5 shrink-0" aria-hidden="true" />
          Naše kolekce
        </span>

        <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          Katalog
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
          Prohlédněte si naši kolekci stylového oblečení. Každý kousek je
          unikát — pečlivě vybraný a zkontrolovaný.
        </p>
        <p className="mt-3 text-sm font-medium text-muted-foreground/80">
          {productCount}{" "}
          {productCount === 1
            ? "kousek"
            : productCount >= 2 && productCount <= 4
              ? "kousky"
              : "kousků"}{" "}
          v nabídce
        </p>
      </div>
    </div>
  );
}
