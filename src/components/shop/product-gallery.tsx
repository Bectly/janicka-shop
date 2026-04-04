"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

const SWIPE_THRESHOLD = 50;

interface ProductGalleryProps {
  images: string[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    dragging: boolean;
    didDrag: boolean;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  }>({ dragging: false, didDrag: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 });
  const touchRef = useRef<{
    startX: number;
    startY: number;
    currentOffset: number;
    swiping: boolean;
    directionLocked: boolean;
  }>({ startX: 0, startY: 0, currentOffset: 0, swiping: false, directionLocked: false });

  const openLightbox = useCallback(
    (index: number) => {
      setActiveIndex(index);
      setLightboxOpen(true);
      setZoomed(false);
      setPanOffset({ x: 0, y: 0 });
    },
    [],
  );

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setZoomed(false);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setZoomed(false);
    setPanOffset({ x: 0, y: 0 });
  }, [images.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setZoomed(false);
    setPanOffset({ x: 0, y: 0 });
  }, [images.length]);

  const toggleZoom = useCallback(() => {
    setZoomed((z) => {
      if (!z) setPanOffset({ x: 0, y: 0 });
      return !z;
    });
  }, []);

  // Touch swipe handlers for mobile gallery navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (images.length <= 1) return;
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentOffset: 0,
      swiping: false,
      directionLocked: false,
    };
  }, [images.length]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (images.length <= 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchRef.current.startX;
    const dy = touch.clientY - touchRef.current.startY;

    // Lock direction on first significant movement to avoid hijacking vertical scroll
    if (!touchRef.current.directionLocked) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        touchRef.current.directionLocked = true;
        touchRef.current.swiping = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!touchRef.current.swiping) return;

    // Prevent vertical scroll while swiping horizontally
    e.preventDefault();
    touchRef.current.currentOffset = dx;
    setSwipeOffset(dx);
  }, [images.length]);

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current.swiping) {
      setSwipeOffset(0);
      return;
    }
    // Read offset from ref to avoid stale closure when touchEnd fires
    // in the same frame as the last touchMove before React re-renders
    const offset = touchRef.current.currentOffset;
    if (offset < -SWIPE_THRESHOLD) {
      goNext();
    } else if (offset > SWIPE_THRESHOLD) {
      goPrev();
    }
    setSwipeOffset(0);
    touchRef.current.swiping = false;
  }, [goNext, goPrev]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, closeLightbox, goNext, goPrev]);

  // Mouse drag for panning when zoomed
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!zoomed) return;
      e.preventDefault();
      dragRef.current = {
        dragging: true,
        didDrag: false,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: panOffset.x,
        startOffsetY: panOffset.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [zoomed, panOffset],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      // Mark as actual drag if moved beyond a small threshold
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragRef.current.didDrag = true;
      }
      setPanOffset({
        x: dragRef.current.startOffsetX + dx,
        y: dragRef.current.startOffsetY + dy,
      });
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

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
    <>
      <div className="space-y-3">
        {/* Main image — swipeable on touch devices */}
        <div
          className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            onClick={() => openLightbox(activeIndex)}
            className="absolute inset-0 z-10 cursor-zoom-in"
            aria-label="Zvětšit obrázek"
          >
            <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <ZoomIn className="size-3.5" />
              Zvětšit
            </span>
          </button>
          <Image
            src={images[activeIndex]}
            alt={`${productName} — fotka ${activeIndex + 1}`}
            fill
            className="object-cover transition-transform duration-150 ease-out"
            style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
          {images.length > 1 && (
            <>
              {/* Desktop-only nav arrows (hidden on touch via hover) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) =>
                    prev === 0 ? images.length - 1 : prev - 1,
                  );
                }}
                className="absolute top-1/2 left-2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-1.5 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
                aria-label="Předchozí fotka"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex((prev) =>
                    prev === images.length - 1 ? 0 : prev + 1,
                  );
                }}
                className="absolute top-1/2 right-2 z-20 -translate-y-1/2 rounded-full bg-white/80 p-1.5 opacity-0 shadow transition-opacity hover:bg-white group-hover:opacity-100"
                aria-label="Další fotka"
              >
                <ChevronRight className="size-5" />
              </button>
              {/* Image counter + dot indicators */}
              <div className="absolute right-3 top-3 z-20 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white lg:hidden">
                {activeIndex + 1} / {images.length}
              </div>
              <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(i);
                    }}
                    className={`size-2 rounded-full transition-all ${
                      i === activeIndex
                        ? "scale-125 bg-white"
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

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} — galerie`}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Zavřít galerii"
          >
            <X className="size-6" />
          </button>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white">
              {activeIndex + 1} / {images.length}
            </div>
          )}

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:left-4 sm:p-3"
                aria-label="Předchozí fotka"
              >
                <ChevronLeft className="size-6 sm:size-8" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:right-4 sm:p-3"
                aria-label="Další fotka"
              >
                <ChevronRight className="size-6 sm:size-8" />
              </button>
            </>
          )}

          {/* Main lightbox image — swipeable */}
          <div
            ref={imgContainerRef}
            className={`relative h-[85vh] w-[90vw] max-w-5xl select-none ${
              zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
            }`}
            onClick={(e) => {
              if (!dragRef.current.didDrag) toggleZoom();
              dragRef.current.didDrag = false;
              e.stopPropagation();
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onTouchStart={!zoomed ? handleTouchStart : undefined}
            onTouchMove={!zoomed ? handleTouchMove : undefined}
            onTouchEnd={!zoomed ? handleTouchEnd : undefined}
          >
            <Image
              src={images[activeIndex]}
              alt={`${productName} — fotka ${activeIndex + 1}`}
              fill
              className="object-contain transition-transform duration-200"
              style={{
                transform: zoomed
                  ? `scale(2) translate(${panOffset.x / 2}px, ${panOffset.y / 2}px)`
                  : swipeOffset !== 0
                    ? `translateX(${swipeOffset}px)`
                    : "scale(1)",
              }}
              sizes="90vw"
              quality={90}
            />
          </div>

          {/* Thumbnail strip at bottom */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(i);
                    setZoomed(false);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className={`relative size-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:size-14 ${
                    i === activeIndex
                      ? "border-white ring-1 ring-white/50"
                      : "border-transparent opacity-50 hover:opacity-80"
                  }`}
                >
                  <Image
                    src={url}
                    alt={`${productName} — náhled ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
