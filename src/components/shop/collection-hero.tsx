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
    <div className="relative -mx-4 -mt-8 mb-8 overflow-hidden sm:-mx-6 lg:-mx-8">
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

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20 lg:px-8 lg:pb-14 lg:pt-24">
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <Layers className="size-3" />
          Kolekce
        </span>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg">
            {description}
          </p>
        )}
        <p className="mt-3 text-sm font-medium text-muted-foreground/80">
          {productCount}{" "}
          {productCount === 1
            ? "kousek"
            : productCount >= 2 && productCount <= 4
              ? "kousky"
              : "kousků"}{" "}
          v kolekci
        </p>
      </div>
    </div>
  );
}
