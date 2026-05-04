"use client";

import Image from "next/image";

const phrases = [
  "Unikátní kusy",
  "Za zlomek ceny",
  "Druhá šance",
  "Ekologicky",
  "Ručně vybrané",
];

// announcement-marquee keyframe (globals.css) translates 0 → -25%, so we
// duplicate phrases ×4 for a seamless loop.
const loop = [...phrases, ...phrases, ...phrases, ...phrases];

export function MarqueeStrip() {
  return (
    <section
      aria-label="Janička — proč nakoupit"
      className="overflow-hidden border-y border-brand/10 bg-blush-light py-stack-sm"
    >
      <div className="group relative flex">
        <div className="announcement-marquee flex shrink-0 items-center gap-stack-sm whitespace-nowrap text-sm font-medium tracking-wider text-charcoal/80 uppercase group-hover:[animation-play-state:paused]">
          {loop.map((phrase, i) => (
            <span key={`${phrase}-${i}`} className="flex items-center gap-stack-sm">
              <span>{phrase}</span>
              <Image
                src="/decor/sparkle.svg"
                alt=""
                aria-hidden="true"
                width={16}
                height={16}
                className="size-4 shrink-0 text-brand/40"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
