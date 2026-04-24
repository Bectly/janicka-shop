"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductCarouselProps {
  children: React.ReactNode;
  ariaLabel: string;
}

export function ProductCarousel({ children, ariaLabel }: ProductCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateButtons();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateButtons, { passive: true });
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      ro.disconnect();
    };
  }, [updateButtons]);

  const scrollByOne = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const firstItem = el.querySelector<HTMLElement>("[data-carousel-item]");
    const gap = 16;
    const delta = (firstItem?.offsetWidth ?? el.clientWidth * 0.8) + gap;
    el.scrollBy({ left: dir * delta, behavior: "smooth" });
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        role="region"
        aria-label={ariaLabel}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {Array.isArray(children)
          ? children.map((child, i) => (
              <div
                key={i}
                data-carousel-item
                className="w-[42vw] max-w-[200px] flex-shrink-0 snap-start sm:w-[30vw] sm:max-w-[240px] lg:w-[22%] lg:max-w-none"
              >
                {child}
              </div>
            ))
          : children}
      </div>
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByOne(-1)}
          aria-label="Předchozí"
          className="absolute top-1/2 left-2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 shadow-md backdrop-blur-sm transition hover:bg-background lg:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByOne(1)}
          aria-label="Další"
          className="absolute top-1/2 right-2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border bg-background/95 shadow-md backdrop-blur-sm transition hover:bg-background lg:flex"
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}
