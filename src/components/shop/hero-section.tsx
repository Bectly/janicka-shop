"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

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

export function HeroSection() {
  const [mounted, setMounted] = useState(false);
  const petalsRef = useRef(generatePetals(12));

  useEffect(() => {
    // Trigger entrance animation after mount
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const petals = petalsRef.current;

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60">
      {/* Cherry blossom petals — CSS animated, no JS runtime cost */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {petals.map((p) => (
          <svg
            key={p.id}
            className="hero-petal absolute"
            style={{
              left: `${p.left}%`,
              top: "-20px",
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

      {/* Hero content */}
      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        {/* Logo — dominant, first thing visitor sees */}
        <div
          className={`transition-all duration-1000 ease-out ${
            mounted
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-4"
          }`}
        >
          <Image
            src="/logo/logo-transparent.png"
            alt="Janička — Třešňová Větvička"
            width={400}
            height={218}
            priority
            className="mx-auto h-auto w-[200px] drop-shadow-lg sm:w-[280px] lg:w-[360px]"
          />
        </div>

        {/* Brand name */}
        <h1
          className={`mt-6 font-heading text-2xl font-bold tracking-tight text-charcoal sm:mt-8 sm:text-3xl lg:text-4xl transition-all duration-1000 delay-200 ease-out ${
            mounted
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
          }`}
        >
          Třešňová Větvička
        </h1>

        {/* Tagline */}
        <p
          className={`mt-3 max-w-md text-base leading-relaxed text-charcoal-light sm:mt-4 sm:max-w-lg sm:text-lg lg:text-xl transition-all duration-1000 delay-400 ease-out ${
            mounted
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
          }`}
        >
          Unikátní kousky za&nbsp;zlomek ceny. Značkové oblečení
          v&nbsp;skvělém stavu, udržitelná móda pro moderní ženy.
        </p>

        {/* Second hand badge */}
        <p
          className={`mt-2 text-sm font-medium tracking-wider text-brand uppercase sm:text-base transition-all duration-1000 delay-500 ease-out ${
            mounted
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
          }`}
        >
          Second hand &amp; vintage
        </p>

        {/* CTA buttons */}
        <div
          className={`mt-8 flex flex-wrap justify-center gap-3 sm:mt-10 transition-all duration-1000 delay-700 ease-out ${
            mounted
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-6"
          }`}
        >
          <Button size="lg" render={<Link href="/products" />}>
            Prohlédnout kolekci
            <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            render={<Link href="/products?sale=true" />}
          >
            Výprodej
          </Button>
        </div>
      </div>
    </section>
  );
}
