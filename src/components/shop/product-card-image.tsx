"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWUwZGIiLz48L3N2Zz4=";

const MAX_THUMBS = 5;

interface ProductCardImageProps {
  images: string[];
  alt: string;
  /** Responsive sizes hint passed to next/image */
  sizes: string;
  /** Above-the-fold cards get LCP priority on the first image */
  priority?: boolean;
  /** Render the hover thumbnail strip (desktop only). Default true. */
  showThumbStrip?: boolean;
}

export function ProductCardImage({
  images,
  alt,
  sizes,
  priority = false,
  showThumbStrip = true,
}: ProductCardImageProps) {
  // null = no thumb hovered (CSS crossfade governs preview).
  // number = explicit thumb index — that image wins, crossfade is suppressed.
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const reset = useCallback(() => setHoveredIdx(null), []);
  const handleThumbActivate = useCallback(
    (idx: number) => (e: React.SyntheticEvent) => {
      // Stop the event from bubbling to parent <Link> (PDP navigation).
      e.preventDefault();
      e.stopPropagation();
      setHoveredIdx(idx);
    },
    [],
  );

  if (images.length === 0) {
    return (
      <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
        <span className="text-3xl text-muted-foreground/30">{alt.charAt(0)}</span>
      </div>
    );
  }

  const main = images[0];
  const second = images[1];
  const thumbs = images.slice(0, MAX_THUMBS);
  const hasMultiple = images.length > 1;

  // When no thumb is hovered we keep the legacy CSS-driven crossfade ([0]→[1] on
  // group-hover) so users who never reach a thumb still see the second image.
  // When a thumb IS hovered, render that image explicitly and suppress the
  // crossfade — otherwise hovering thumb 0 would leak images[1] over images[0]
  // and thumb 1 would look identical to thumb 0 (off-by-2 bug).
  const explicitOverlay = hoveredIdx !== null ? images[hoveredIdx] : null;

  return (
    <div className="absolute inset-0" onMouseLeave={reset}>
      {/* Layer 1: primary image (always rendered) */}
      <Image
        src={main}
        alt={alt}
        fill
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        unoptimized
      />

      {/* Layer 2: secondary image — CSS hover crossfade (preserves legacy UX) */}
      {second && hoveredIdx === null && (
        <Image
          src={second}
          alt={`${alt} — detail`}
          fill
          className="object-cover opacity-0 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:scale-105"
          sizes={sizes}
          unoptimized
          loading="lazy"
        />
      )}

      {/* Layer 3: explicit thumb selection (cross-fade in) */}
      {explicitOverlay && (
        <Image
          key={`overlay-${hoveredIdx}`}
          src={explicitOverlay}
          alt={`${alt} — foto ${(hoveredIdx ?? 0) + 1}`}
          fill
          className="object-cover opacity-100 transition-opacity duration-200 ease-out group-hover:scale-105"
          sizes={sizes}
          unoptimized
          loading="lazy"
        />
      )}

      {/* Hover thumbnail strip — desktop only (touch can't hover) */}
      {showThumbStrip && hasMultiple && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] hidden p-2 sm:flex">
          <div className="pointer-events-auto mx-auto flex max-w-full gap-1 overflow-x-auto scrollbar-none rounded-full bg-background/90 p-1 shadow-md backdrop-blur-sm opacity-0 translate-y-2 transition-all duration-200 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0">
            {thumbs.map((url, i) => {
              const isActive = i === hoveredIdx;
              const compact = thumbs.length >= 5;
              return (
                <button
                  key={`${url}-${i}`}
                  type="button"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onFocus={() => setHoveredIdx(i)}
                  onClick={handleThumbActivate(i)}
                  aria-label={`Zobrazit foto ${i + 1}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-full border-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    compact ? "size-7" : "size-9",
                    isActive
                      ? "border-primary"
                      : "border-transparent hover:border-primary/40",
                  )}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes={compact ? "28px" : "36px"}
                    className="object-cover"
                    unoptimized
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
