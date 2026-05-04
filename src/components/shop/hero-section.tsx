"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowDown, Heart, Percent } from "lucide-react";

/* ─── Cherry blossom petal SVG paths (5 variants) ─── */
const PETAL_PATHS = [
  "M8 0C8 0 16 6 14 12C12 18 4 18 2 12C0 6 8 0 8 0Z",
  "M6 0C6 0 14 4 12 10C10 16 2 14 1 9C0 4 6 0 6 0Z",
  "M7 0C7 0 15 5 13 11C11 17 3 16 1 10C-1 4 7 0 7 0Z",
  "M5 0C5 0 12 5 10 10C8 15 2 13 1 8C0 3 5 0 5 0Z",
  "M8 0C8 0 14 7 12 12C10 17 4 16 2 11C0 6 8 0 8 0Z",
];

function generatePetals(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    path: PETAL_PATHS[i % PETAL_PATHS.length],
    left: Math.random() * 100,
    delay: Math.random() * 8,
    duration: 6 + Math.random() * 6,
    size: 10 + Math.random() * 8,
    opacity: 0.15 + Math.random() * 0.25,
    drift: -30 + Math.random() * 60,
  }));
}

type Petal = ReturnType<typeof generatePetals>[number];

export function HeroSection({
  peekStrip,
  editorialImageUrl,
}: {
  peekStrip?: ReactNode;
  editorialImageUrl?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  // Petals must be generated post-mount — Math.random() in a useState
  // initializer produces different values on the server vs the client and
  // triggers React #418/#419 hydration errors on every page load.
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- non-deterministic petal positions must be generated client-side after hydration
    setPetals(generatePetals(12));
    // Trigger entrance animation after mount
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const hasEditorial = Boolean(editorialImageUrl);

  return (
    <section className="relative min-h-[60vh] lg:min-h-[65vh] overflow-hidden bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60">
      {/* Cherry blossom petals — CSS animated, no JS runtime cost */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {petals.map((p) => (
          <svg
            key={p.id}
            className="hero-petal absolute top-[-20px]"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--petal-drift" as string]: `${p.drift}px`,
              ["--petal-opacity" as string]: String(p.opacity),
            }}
            viewBox="0 0 16 18"
            fill="none"
          >
            <path d={p.path} fill="oklch(0.72 0.14 350)" />
          </svg>
        ))}
      </div>

      {/* Subtle radial glow behind logo */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-brand/5 blur-3xl"
      />

      {/* Grain texture — kills the flat digital feel, adds editorial print quality */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }}
      />

      {/* Hero content */}
      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <h1 className="sr-only">
          Janička — second hand &amp; vintage móda, značkové oblečení levně
        </h1>

        {/* Editorial photo (when admin uploaded) — otherwise the brand logo */}
        <div
          className={`relative transition-all duration-1000 ease-out ${
            mounted
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-4"
          }`}
        >
          {hasEditorial ? (
            <div className="relative mx-auto w-[200px] sm:w-[260px] lg:w-[340px]">
              <Image
                src={editorialImageUrl as string}
                alt="Janička — editoriální foto"
                width={960}
                height={1200}
                priority
                fetchPriority="high"
                sizes="(max-width: 640px) 260px, (max-width: 1024px) 360px, 480px"
                className="h-auto w-full rounded-3xl object-cover shadow-2xl"
              />
              <Image
                src="/logo/logo-transparent.png"
                alt=""
                aria-hidden="true"
                width={120}
                height={66}
                className="absolute bottom-3 right-3 h-auto w-[60px] opacity-70 drop-shadow-md sm:w-[88px]"
              />
            </div>
          ) : (
            <Image
              src="/logo/logo-transparent.png"
              alt="Janička"
              width={400}
              height={218}
              priority
              fetchPriority="high"
              className="mx-auto h-auto w-[200px] drop-shadow-lg sm:w-[280px] lg:w-[360px]"
            />
          )}
        </div>

        {/* Tagline — editorial serif italic accent */}
        <p
          className={`mt-4 max-w-lg font-heading italic text-xl leading-snug text-charcoal sm:mt-6 sm:max-w-xl sm:text-2xl lg:text-3xl transition-all duration-1000 delay-200 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          Každý kousek vybírám a&nbsp;fotím osobně.
        </p>

        {/* Tagline subline — sans, demoted weight */}
        <p
          className={`mt-2 max-w-md text-base leading-relaxed text-charcoal-light/80 sm:text-lg transition-all duration-1000 delay-300 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          Jeden kus, jedna velikost — když ho někdo koupí, zmizí.
        </p>

        {/* Brand editorial pill */}
        <div
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-card/60 backdrop-blur-sm px-4 py-1.5 transition-all duration-1000 delay-[400ms] ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <Heart className="size-3 text-brand" aria-hidden="true" />
          <span className="text-sm font-medium text-brand/80">
            Česká rodinná second hand značka
          </span>
        </div>

        {/* CTA buttons */}
        <div
          className={`mt-8 flex flex-wrap justify-center gap-3 sm:mt-10 transition-all duration-1000 delay-500 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <Button
            size="lg"
            data-track="hero-cta-primary"
            render={<Link href="/products" />}
          >
            Prohlédnout kolekci
            <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            data-track="hero-cta-sale"
            render={<Link href="/products?sale=true" />}
          >
            <Percent data-icon="inline-start" className="size-4" />
            Výprodej
          </Button>
        </div>

        {/* Scroll cue — animated arrow to #new-products */}
        <div
          className={`mt-10 transition-all duration-1000 delay-700 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <a
            href="#new-products"
            className="flex flex-col items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-brand"
          >
            Objevte nové kousky
            <ArrowDown className="size-5 animate-bounce" aria-hidden="true" />
          </a>
        </div>

        {/* Peek strip — 3-4 newest products as slim "passport" cards */}
        {peekStrip}
      </div>
    </section>
  );
}
