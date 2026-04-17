"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Layers } from "lucide-react";

interface CollectionHeroProps {
  title: string;
  description?: string | null;
  image?: string | null;
  productCount: number;
}

export function CollectionHero({
  title,
  description,
  image,
  productCount,
}: CollectionHeroProps) {
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
    <div className="category-hero relative -mx-4 -mt-8 mb-10 overflow-hidden sm:-mx-6 lg:-mx-8">
      {/* Background with parallax */}
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
          <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-champagne-light/50 to-sage-light/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/30 to-transparent" />
      </div>

      {/* Decorative watermark */}
      <div
        className="pointer-events-none absolute right-4 top-6 select-none font-heading text-[12rem] font-bold leading-none text-foreground/[0.03] sm:right-8 sm:text-[16rem] lg:right-16 lg:text-[20rem]"
        aria-hidden="true"
      >
        {title.charAt(0)}
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-24 lg:px-8 lg:pb-20 lg:pt-32">
        <span className="category-hero-stagger mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <Layers className="size-3.5 shrink-0" aria-hidden="true" />
          Kolekce
        </span>

        <h1
          className="category-hero-stagger [animation-delay:80ms] text-display text-foreground"
        >
          {title}
        </h1>

        {/* Decorative accent line */}
        <div
          className="category-hero-stagger [animation-delay:160ms] mt-4 h-[3px] w-12 rounded-full bg-gradient-to-r from-brand to-brand-light"
          aria-hidden="true"
        />

        {description && (
          <p
            className="category-hero-stagger [animation-delay:220ms] mt-4 max-w-xl text-base text-muted-foreground sm:text-lg"
          >
            {description}
          </p>
        )}

        <p
          className="category-hero-stagger [animation-delay:280ms] mt-4 text-sm font-medium text-muted-foreground/80"
        >
          {productCount}{" "}
          {productCount === 1
            ? "kousek"
            : productCount >= 2 && productCount <= 4
              ? "kousky"
              : "kousků"}{" "}
          v kolekci
        </p>
      </div>

      {/* Bottom fade edge */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
