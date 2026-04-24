"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn, Play } from "lucide-react";

const SWIPE_THRESHOLD = 50;

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWUwZGIiLz48L3N2Zz4=";

interface ProductImage {
  url: string;
  alt: string;
}

interface ProductGalleryProps {
  images: (string | ProductImage)[];
  productName: string;
  videoUrl?: string | null;
}

function getUrl(img: string | ProductImage): string {
  return typeof img === "string" ? img : img.url;
}

function getAlt(img: string | ProductImage, productName: string, index: number): string {
  if (typeof img !== "string" && img.alt) return img.alt;
  return `${productName} — fotka ${index + 1}`;
}

function getPinchDist(e: React.TouchEvent): number {
  const t0 = e.touches[0];
  const t1 = e.touches[1];
  return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
}

export function ProductGallery({ images, productName, videoUrl }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video is slide 1 (after first image) for early engagement
  const hasVideo = !!videoUrl;
  const videoSlideIndex = hasVideo ? Math.min(1, images.length) : -1;
  const totalSlides = images.length + (hasVideo ? 1 : 0);
  const isVideoActive = hasVideo && activeIndex === videoSlideIndex;

  // Map slide index → image array index (accounts for video slide offset)
  const getImageIndex = (slideIdx: number) =>
    hasVideo && slideIdx > videoSlideIndex ? slideIdx - 1 : slideIdx;

  // Slide indices that are images (not video) — used for lightbox navigation
  const imageSlideIndices = hasVideo
    ? Array.from({ length: images.length }, (_, i) => (i < videoSlideIndex ? i : i + 1))
    : Array.from({ length: images.length }, (_, i) => i);

  const [lightboxClosing, setLightboxClosing] = useState(false);
  // Numeric zoom (1 = normal, 2+ = zoomed) for pinch-to-zoom support
  const [lbZoom, setLbZoom] = useState(1);
  const isZoomed = lbZoom > 1;
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [lightboxDismissY, setLightboxDismissY] = useState(0);
  const [isLbDismissing, setIsLbDismissing] = useState(false);
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
  const lbDismissRef = useRef<{
    startY: number;
    dismissing: boolean;
  }>({ startY: 0, dismissing: false });
  const pinchRef = useRef<{
    active: boolean;
    startDist: number;
    startZoom: number;
  }>({ active: false, startDist: 0, startZoom: 1 });

  const openLightbox = useCallback(
    (index: number) => {
      setActiveIndex(index);
      setLightboxOpen(true);
      setLbZoom(1);
      setPanOffset({ x: 0, y: 0 });
    },
    [],
  );

  const closeLightbox = useCallback(() => {
    setLightboxClosing(true);
    setTimeout(() => {
      setLightboxOpen(false);
      setLightboxClosing(false);
      setLbZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setLightboxDismissY(0);
    }, 150);
  }, []);

  const goNext = useCallback(() => {
    setSlideDirection("left");
    setActiveIndex((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
    setLbZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setSlideDirection("right");
    setActiveIndex((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
    setLbZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [totalSlides]);

  const toggleZoom = useCallback(() => {
    setLbZoom((z) => {
      if (z <= 1) return 2;
      setPanOffset({ x: 0, y: 0 });
      return 1;
    });
  }, []);

  // Touch swipe handlers for mobile gallery navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (totalSlides <= 1) return;
    const touch = e.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentOffset: 0,
      swiping: false,
      directionLocked: false,
    };
  }, [totalSlides]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (totalSlides <= 1) return;
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
  }, [totalSlides]);

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

  // Keyboard navigation for lightbox — navigate image slides only (skip video)
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowRight") {
        setActiveIndex((prev) => {
          const pos = imageSlideIndices.indexOf(prev);
          return imageSlideIndices[(pos + 1) % imageSlideIndices.length];
        });
        setLbZoom(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === "ArrowLeft") {
        setActiveIndex((prev) => {
          const pos = imageSlideIndices.indexOf(prev);
          return imageSlideIndices[(pos - 1 + imageSlideIndices.length) % imageSlideIndices.length];
        });
        setLbZoom(1);
        setPanOffset({ x: 0, y: 0 });
      }
    };
    document.addEventListener("keydown", handleKey);
    // Lock body scroll — position:fixed trick works on iOS Safari
    // (overflow:hidden alone does NOT prevent scrolling on iOS)
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [lightboxOpen, closeLightbox, imageSlideIndices]);

  // Pause video and reset when leaving video slide (tap-to-play = no autoplay)
  useEffect(() => {
    if (!hasVideo || !videoRef.current) return;
    if (!isVideoActive) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external DOM sync: pauses <video> element on slide change and mirrors the pause state into React
      setVideoPlaying(false);
    }
  }, [isVideoActive, hasVideo]);

  // Lightbox vertical swipe-to-dismiss handlers
  const handleLbDismissStart = useCallback((e: React.TouchEvent) => {
    if (isZoomed) return;
    lbDismissRef.current = { startY: e.touches[0].clientY, dismissing: false };
    setIsLbDismissing(false);
  }, [isZoomed]);

  const handleLbDismissMove = useCallback((e: React.TouchEvent) => {
    if (isZoomed) return;
    const dy = e.touches[0].clientY - lbDismissRef.current.startY;
    if (Math.abs(dy) > 15) {
      if (!lbDismissRef.current.dismissing) {
        lbDismissRef.current.dismissing = true;
        setIsLbDismissing(true);
      }
      setLightboxDismissY(dy * 0.6);
    }
  }, [isZoomed]);

  const handleLbDismissEnd = useCallback(() => {
    if (!lbDismissRef.current.dismissing) return;
    lbDismissRef.current.dismissing = false;
    setIsLbDismissing(false);
    if (Math.abs(lightboxDismissY) > 100) {
      closeLightbox();
    } else {
      setLightboxDismissY(0);
    }
  }, [lightboxDismissY, closeLightbox]);

  // Mouse drag for panning when zoomed
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isZoomed) return;
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
    [isZoomed, panOffset],
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

  if (totalSlides === 0) {
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
      <div className="min-w-0 max-w-full overflow-hidden space-y-3">
        {/* Main image/video — swipeable on touch devices */}
        <div
          className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {isVideoActive ? (
            /* Video slide — tap-to-play per Shopify CRO 2026 (no autoplay) */
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                src={videoUrl!}
                muted
                loop
                playsInline
                preload="metadata"
                className="size-full object-contain"
              />
              {!videoPlaying && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoPlaying(true);
                    videoRef.current?.play().catch(() => {});
                  }}
                  className="absolute inset-0 z-10 flex items-center justify-center"
                  aria-label="Přehrát video produktu"
                >
                  <div className="flex size-20 items-center justify-center rounded-full bg-white/90 shadow-xl transition-transform duration-150 hover:scale-110 active:scale-95">
                    <Play className="size-8 translate-x-0.5 text-black" fill="currentColor" />
                  </div>
                </button>
              )}
            </div>
          ) : (
            /* Image slide */
            <>
              <button
                type="button"
                onClick={() => openLightbox(activeIndex)}
                className="absolute inset-0 z-10 cursor-zoom-in"
                aria-label="Zvětšit obrázek"
              >
                <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <ZoomIn className="size-3.5" />
                  Zvětšit
                </span>
              </button>
              <Image
                key={`slide-${activeIndex}`}
                src={getUrl(images[getImageIndex(activeIndex)])}
                alt={getAlt(images[getImageIndex(activeIndex)], productName, getImageIndex(activeIndex))}
                fill
                className={`object-cover ${
                  swipeOffset !== 0
                    ? "transition-transform duration-150 ease-out"
                    : slideDirection === "left"
                      ? "animate-slide-in-left"
                      : slideDirection === "right"
                        ? "animate-slide-in-right"
                        : ""
                }`}
                style={swipeOffset !== 0 ? { transform: `translateX(${swipeOffset}px)` } : undefined}
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority={activeIndex === 0}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                quality={90}
                onAnimationEnd={() => setSlideDirection(null)}
              />
            </>
          )}
          {totalSlides > 1 && (
            <>
              {/* Desktop-only nav arrows (hidden on touch via hover) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSlideDirection("right");
                  setActiveIndex((prev) =>
                    prev === 0 ? totalSlides - 1 : prev - 1,
                  );
                }}
                className="absolute top-1/2 left-2 z-20 -translate-y-1/2 scale-90 rounded-full bg-white/80 p-2.5 opacity-0 shadow transition-all duration-150 hover:bg-white group-hover:scale-100 group-hover:opacity-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:opacity-100 focus-visible:scale-100"
                aria-label="Předchozí fotka"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSlideDirection("left");
                  setActiveIndex((prev) =>
                    prev === totalSlides - 1 ? 0 : prev + 1,
                  );
                }}
                className="absolute top-1/2 right-2 z-20 -translate-y-1/2 scale-90 rounded-full bg-white/80 p-2.5 opacity-0 shadow transition-all duration-150 hover:bg-white group-hover:scale-100 group-hover:opacity-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:opacity-100 focus-visible:scale-100"
                aria-label="Další fotka"
              >
                <ChevronRight className="size-5" />
              </button>
              {/* Slide counter + dot indicators */}
              <div className="absolute right-3 top-3 z-20 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white lg:hidden">
                {activeIndex + 1} / {totalSlides}
              </div>
              <div className="absolute bottom-3 left-1/2 z-20 flex max-w-[90%] -translate-x-1/2 overflow-hidden">
                {Array.from({ length: totalSlides }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlideDirection(i > activeIndex ? "left" : "right");
                      setActiveIndex(i);
                    }}
                    className={`inline-flex shrink-0 items-center justify-center ${totalSlides > 8 ? "size-8" : "size-11"}`}
                    aria-label={i === videoSlideIndex ? "Video" : `Fotka ${i + 1}`}
                  >
                    <span className={`size-2 rounded-full transition-all duration-150 ${
                      i === activeIndex
                        ? "scale-125 bg-white"
                        : "bg-white/50 hover:bg-white/75 hover:scale-110"
                    }`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Thumbnails — video interleaved at its slide position */}
        {totalSlides > 1 && (
          <div className="flex gap-2 overflow-x-auto overflow-y-hidden scrollbar-none pb-1">
            {Array.from({ length: totalSlides }, (_, slideIdx) => {
              if (hasVideo && slideIdx === videoSlideIndex) {
                return (
                  <button
                    key="video-thumb"
                    type="button"
                    onClick={() => { setSlideDirection(slideIdx > activeIndex ? "left" : "right"); setActiveIndex(slideIdx); }}
                    className={`relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 bg-muted transition-all duration-150 sm:size-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                      activeIndex === videoSlideIndex
                        ? "border-primary ring-1 ring-primary scale-[1.03]"
                        : "border-transparent opacity-70 hover:opacity-100 hover:scale-[1.03]"
                    }`}
                    aria-label="Video"
                  >
                    <Play className="size-6 text-muted-foreground" fill="currentColor" />
                  </button>
                );
              }
              const imgIdx = getImageIndex(slideIdx);
              const img = images[imgIdx];
              return (
                <button
                  key={`${getUrl(img)}-${imgIdx}`}
                  type="button"
                  onClick={() => { setSlideDirection(slideIdx > activeIndex ? "left" : "right"); setActiveIndex(slideIdx); }}
                  className={`relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-150 sm:size-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                    slideIdx === activeIndex
                      ? "border-primary ring-1 ring-primary scale-[1.03]"
                      : "border-transparent opacity-70 hover:opacity-100 hover:scale-[1.03] active:scale-95"
                  }`}
                  aria-label={`${productName} — náhled ${imgIdx + 1}`}
                >
                  <Image
                    src={getUrl(img)}
                    alt={getAlt(img, productName, imgIdx)}
                    fill
                    loading="lazy"
                    className="object-cover"
                    sizes="80px"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox — images only, no video */}
      {lightboxOpen && !isVideoActive && (
        <div
          className={`fixed inset-0 z-[100] flex touch-none items-center justify-center bg-black/95 overscroll-none ${
            lightboxClosing ? "animate-lightbox-close" : "animate-lightbox-open"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} — galerie`}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors duration-150 hover:bg-white/20"
            aria-label="Zavřít galerii"
          >
            <X className="size-6" />
          </button>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white">
              {imageSlideIndices.indexOf(activeIndex) + 1} / {images.length}
            </div>
          )}

          {/* Navigation arrows — navigate image slides only (skip video) */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveIndex((prev) => {
                    const pos = imageSlideIndices.indexOf(prev);
                    return imageSlideIndices[(pos - 1 + imageSlideIndices.length) % imageSlideIndices.length];
                  });
                  setLbZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="absolute top-1/2 left-2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-all duration-150 hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4 sm:p-3"
                aria-label="Předchozí fotka"
              >
                <ChevronLeft className="size-6 sm:size-8" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveIndex((prev) => {
                    const pos = imageSlideIndices.indexOf(prev);
                    return imageSlideIndices[(pos + 1) % imageSlideIndices.length];
                  });
                  setLbZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-all duration-150 hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4 sm:p-3"
                aria-label="Další fotka"
              >
                <ChevronRight className="size-6 sm:size-8" />
              </button>
            </>
          )}

          {/* Main lightbox image — swipeable + pinch-to-zoom + vertical dismiss */}
          <div
            ref={imgContainerRef}
            className={`relative flex items-center justify-center select-none overflow-hidden w-[92vw] h-[85vh] max-w-[40rem] ${
              isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
            }`}
            style={{
              transform: lightboxDismissY !== 0
                ? `translateY(${lightboxDismissY}px)`
                : undefined,
              opacity: lightboxDismissY !== 0
                ? Math.max(0.3, 1 - Math.abs(lightboxDismissY) / 300)
                : undefined,
              transition: isLbDismissing
                ? undefined
                : "transform 200ms ease, opacity 200ms ease",
            }}
            onClick={(e) => {
              if (!dragRef.current.didDrag && !lbDismissRef.current.dismissing) toggleZoom();
              dragRef.current.didDrag = false;
              e.stopPropagation();
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                // Pinch start — capture initial distance and zoom level
                pinchRef.current = {
                  active: true,
                  startDist: getPinchDist(e),
                  startZoom: lbZoom,
                };
                return;
              }
              if (!isZoomed) {
                handleTouchStart(e);
                handleLbDismissStart(e);
              }
            }}
            onTouchMove={(e) => {
              if (pinchRef.current.active && e.touches.length === 2) {
                e.preventDefault();
                const dist = getPinchDist(e);
                const newZoom = Math.max(
                  1,
                  Math.min(4, pinchRef.current.startZoom * (dist / pinchRef.current.startDist)),
                );
                setLbZoom(newZoom);
                return;
              }
              if (!isZoomed) {
                handleTouchMove(e);
                handleLbDismissMove(e);
              }
            }}
            onTouchEnd={() => {
              if (pinchRef.current.active) {
                pinchRef.current.active = false;
                // Snap back to 1.0 if barely zoomed
                setLbZoom((z) => {
                  if (z < 1.2) {
                    setPanOffset({ x: 0, y: 0 });
                    return 1;
                  }
                  return z;
                });
                return;
              }
              if (!isZoomed) {
                handleTouchEnd();
                handleLbDismissEnd();
              }
            }}
          >
            <Image
              src={getUrl(images[getImageIndex(activeIndex)])}
              alt={getAlt(images[getImageIndex(activeIndex)], productName, getImageIndex(activeIndex))}
              fill
              priority
              className="object-contain transition-transform duration-200"
              style={{
                transform: isZoomed
                  ? `scale(${lbZoom}) translate(${panOffset.x / lbZoom}px, ${panOffset.y / lbZoom}px)`
                  : swipeOffset !== 0
                    ? `translateX(${swipeOffset}px)`
                    : undefined,
              }}
              sizes="(max-width: 640px) 80vw, 32rem"
              quality={95}
            />
          </div>

          {/* Thumbnail strip at bottom */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
              {imageSlideIndices.map((slideIdx) => {
                const imgIdx = getImageIndex(slideIdx);
                const img = images[imgIdx];
                return (
                  <button
                    key={`${getUrl(img)}-${imgIdx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveIndex(slideIdx);
                      setLbZoom(1);
                      setPanOffset({ x: 0, y: 0 });
                    }}
                    className={`relative size-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:size-14 ${
                      slideIdx === activeIndex
                        ? "border-white ring-1 ring-white/50"
                        : "border-transparent opacity-50 hover:opacity-80"
                    }`}
                    aria-label={`${productName} — fotka ${imgIdx + 1}`}
                  >
                    <Image
                      src={getUrl(img)}
                      alt={getAlt(img, productName, imgIdx)}
                      fill
                      loading="lazy"
                      className="object-cover"
                      sizes="56px"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
