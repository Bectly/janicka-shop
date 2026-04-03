"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-muted">
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
          <span className="text-6xl text-muted-foreground/20">
            {productName.charAt(0)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted">
        <Image
          src={images[activeIndex]}
          alt={`${productName} — fotka ${activeIndex + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setActiveIndex((prev) =>
                  prev === 0 ? images.length - 1 : prev - 1
                )
              }
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
              aria-label="Předchozí fotka"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveIndex((prev) =>
                  prev === images.length - 1 ? 0 : prev + 1
                )
              }
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
              aria-label="Další fotka"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`size-2 rounded-full transition-all ${
                    i === activeIndex
                      ? "bg-white scale-125"
                      : "bg-white/50 hover:bg-white/75"
                  }`}
                  aria-label={`Fotka ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:size-20 ${
                i === activeIndex
                  ? "border-primary ring-1 ring-primary"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <Image
                src={url}
                alt={`${productName} — náhled ${i + 1}`}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
