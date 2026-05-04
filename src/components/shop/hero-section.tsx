"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

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

export function HeroSection() {
  const [mounted, setMounted] = useState(false);
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration
    setPetals(generatePetals(6));
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    // max-h-hero-sm / max-h-hero: token-based CEILING, NOT min-h.
    // 3 prior failures (#5279/#5283/#5284) used min-h — content overran the envelope.
    // Ganni-pattern spec: docs/research/fashion-hero-patterns-2026-05-04.md
    <section className="relative flex max-h-hero-sm sm:max-h-hero items-center overflow-hidden bg-gradient-to-br from-brand-light/40 via-blush to-champagne-light/60">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
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
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-brand/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-6 text-center sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <h1 className="sr-only">
          Janička — second hand &amp; vintage móda, značkové oblečení levně
        </h1>
        <div
          className={`relative transition-all duration-1000 ease-out ${
            mounted ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-4"
          }`}
        >
          <Image
            src="/logo/logo-transparent.png"
            alt="Janička"
            width={400}
            height={218}
            priority
            fetchPriority="high"
            className="mx-auto h-auto w-[112px] drop-shadow-lg sm:w-[140px] lg:w-[160px]"
          />
        </div>
        <p
          className={`mt-3 max-w-xl font-heading italic text-lg leading-snug text-charcoal sm:mt-4 sm:text-xl lg:text-2xl transition-all duration-1000 delay-200 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          Každý kousek vybírám a fotím osobně.
        </p>
        <div
          className={`mt-5 transition-all duration-1000 delay-[400ms] ease-out sm:mt-6 ${
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
        </div>
      </div>
    </section>
  );
}
