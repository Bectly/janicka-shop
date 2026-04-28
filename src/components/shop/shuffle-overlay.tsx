"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Shuffle,
  Heart,
  ShoppingBag,
  X,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useCartStore } from "@/lib/cart-store";
import { useShuffleStore } from "@/lib/shuffle-store";
import { reserveProduct } from "@/lib/actions/reservation";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { parseJsonStringArray } from "@/lib/images";
import type { ShuffleProduct } from "@/app/api/products/random/route";

const SEEN_KEY = "shuffle-seen-v1";
const SIZES_KEY = "shuffle-sizes-v1";
const BATCH_SIZE = 10;
const LOW_WATER_MARK = 3;
const SWIPE_THRESHOLD = 80;
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;

type Direction = "left" | "right" | null;

export function ShuffleOverlay() {
  const open = useShuffleStore((s) => s.open);
  const close = useShuffleStore((s) => s.closeShuffle);

  const [queue, setQueue] = useState<ShuffleProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [exitDir, setExitDir] = useState<Direction>(null);
  const [animating, setAnimating] = useState(false);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedFlash, setAddedFlash] = useState<"cart" | "wishlist" | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);

  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const hasWishlist = useWishlistStore((s) => s.has);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);

  const seenRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const initializedRef = useRef(false);

  // Hydrate seen set from sessionStorage + selected sizes from localStorage once
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SEEN_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) seenRef.current = new Set(arr);
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(SIZES_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) {
          const valid = arr.filter((s): s is string =>
            typeof s === "string" && (SIZE_OPTIONS as readonly string[]).includes(s),
          );
          if (valid.length > 0) setSelectedSizes(valid);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistSeen = useCallback(() => {
    try {
      const arr = Array.from(seenRef.current).slice(-500);
      sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
    } catch {
      /* ignore */
    }
  }, []);

  const fetchBatch = useCallback(
    async (append: boolean) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        const exclude = Array.from(seenRef.current).slice(-200).join(",");
        const sizesQs = selectedSizes.length > 0 ? selectedSizes.join(",") : "";
        const url = `/api/products/random?limit=${BATCH_SIZE}${
          exclude ? `&exclude=${encodeURIComponent(exclude)}` : ""
        }${sizesQs ? `&sizes=${encodeURIComponent(sizesQs)}` : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("fetch-failed");
        const data = (await res.json()) as { items: ShuffleProduct[] };
        const fresh = data.items.filter((p) => !seenRef.current.has(p.id));
        if (fresh.length === 0) {
          setQueue((prev) => {
            if (!append || prev.length === 0) setExhausted(true);
            return prev;
          });
          return;
        }
        setExhausted(false);
        setQueue((prev) => (append ? [...prev, ...fresh] : fresh));
      } catch {
        /* swallow — UI shows loading state */
      } finally {
        fetchingRef.current = false;
        setLoading(false);
      }
    },
    [selectedSizes]
  );

  const toggleSize = useCallback((size: string) => {
    setSelectedSizes((prev) => {
      const next = prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size];
      try {
        localStorage.setItem(SIZES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setQueue([]);
    setExhausted(false);
    setLoading(true);
  }, []);

  // Refetch when size filter changes (queue was cleared in toggleSize)
  useEffect(() => {
    if (!open) return;
    if (!initializedRef.current) return;
    if (queue.length > 0) return;
    fetchBatch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSizes]);

  // Initial fetch when overlay opens for the first time
  useEffect(() => {
    if (!open) return;
    if (initializedRef.current) return;
    initializedRef.current = true;
    setLoading(true);
    fetchBatch(false);
  }, [open, fetchBatch]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Top-up when running low
  useEffect(() => {
    if (!open) return;
    if (!loading && !exhausted && queue.length > 0 && queue.length <= LOW_WATER_MARK) {
      fetchBatch(true);
    }
  }, [queue.length, loading, exhausted, fetchBatch, open]);

  const current = queue[0];
  const next = queue[1];

  const advance = useCallback(
    (dir: Exclude<Direction, null>) => {
      if (!current || animating) return;
      seenRef.current.add(current.id);
      persistSeen();
      setExitDir(dir);
      setAnimating(true);
      setDragDx(0);
      setDragging(false);
      setTimeout(() => {
        setQueue((q) => q.slice(1));
        setExitDir(null);
        setAnimating(false);
      }, 320);
    },
    [current, animating, persistSeen]
  );

  const handleShuffle = useCallback(() => advance("right"), [advance]);

  const handleWishlistSwipe = useCallback(() => {
    if (!current) return;
    if (!hasWishlist(current.id)) {
      toggleWishlist(current.id);
      setAddedFlash("wishlist");
      setTimeout(() => setAddedFlash(null), 900);
    }
    advance("left");
  }, [current, hasWishlist, toggleWishlist, advance]);

  const handleAddToCart = useCallback(async () => {
    if (!current || adding) return;
    const inCart = cartItems.some((i) => i.productId === current.id);
    if (inCart) {
      advance("right");
      return;
    }
    setAdding(true);
    try {
      const result = await reserveProduct(current.id);
      if (!result.success) {
        setAdding(false);
        return;
      }
      const sizes = parseJsonStringArray(current.sizes);
      const colors = parseJsonStringArray(current.colors);
      addItem({
        productId: current.id,
        name: current.name,
        price: current.price,
        image: current.images[0] ?? "",
        size: sizes[0] ?? "",
        color: colors[0] ?? "",
        quantity: 1,
        slug: current.slug,
        reservedUntil: result.reservedUntil,
      });
      setAddedFlash("cart");
      setTimeout(() => setAddedFlash(null), 900);
      advance("right");
    } finally {
      setAdding(false);
    }
  }, [current, adding, cartItems, addItem, advance]);

  // Keyboard: Escape closes; arrows/space/enter control deck
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        handleShuffle();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleWishlistSwipe();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void handleAddToCart();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, handleShuffle, handleWishlistSwipe, handleAddToCart]);

  // Touch
  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return;
    touchStartX.current = e.touches[0].clientX;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    setDragDx(e.touches[0].clientX - touchStartX.current);
  };
  const onTouchEnd = () => {
    const dx = dragDx;
    touchStartX.current = null;
    setDragging(false);
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0) handleShuffle();
      else handleWishlistSwipe();
    } else {
      setDragDx(0);
    }
  };

  if (!open) return null;

  const cardTransform = (() => {
    if (exitDir === "right") return "translate3d(120%, -40px, 0) rotate(18deg)";
    if (exitDir === "left") return "translate3d(-120%, -40px, 0) rotate(-18deg)";
    if (dragging) return `translate3d(${dragDx}px, 0, 0) rotate(${dragDx * 0.05}deg)`;
    return "translate3d(0,0,0) rotate(0deg)";
  })();

  const overlayOpacity = Math.min(Math.abs(dragDx) / SWIPE_THRESHOLD, 1);
  const showRightHint = dragDx > 20;
  const showLeftHint = dragDx < -20;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-hidden bg-background/70 backdrop-blur-xl animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Objevuj náhodné kousky"
    >
      {/* Click-outside backdrop (behind panel) */}
      <button
        type="button"
        aria-label="Zavřít"
        onClick={close}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative mx-auto flex w-full max-w-xl flex-col px-4 pb-6 pt-4 sm:pt-6">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            aria-label="Zavřít"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="size-4 text-primary" />
            Objevuj
          </div>
          <div className="w-[40px]" aria-hidden />
        </div>

        <p className="mb-3 text-center text-sm text-muted-foreground">
          Swipe ← do oblíbených · swipe → další kousek
        </p>

        {/* Size filter chips */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
          {SIZE_OPTIONS.map((size) => {
            const active = selectedSizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                aria-pressed={active}
                className={`min-h-[32px] rounded-full border px-3 text-xs font-medium transition-colors duration-150 ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>

        {/* Card area */}
        <div className="relative mx-auto flex w-full max-w-md flex-1 items-center justify-center">
          {loading ? (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-3xl bg-muted/40">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : !current ? (
            <EmptyState
              exhausted={exhausted}
              onReset={() => {
                seenRef.current.clear();
                persistSeen();
                setExhausted(false);
                setLoading(true);
                fetchBatch(false);
              }}
            />
          ) : (
            <div className="relative aspect-[3/4] w-full">
              {next && (
                <ShuffleCard
                  product={next}
                  peek
                  className="absolute inset-0 scale-[0.96] opacity-70"
                />
              )}

              <div
                className="absolute inset-0 touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                  transform: cardTransform,
                  transition: dragging
                    ? "none"
                    : "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
                  willChange: "transform",
                }}
              >
                <ShuffleCard product={current} onProductClick={close}>
                  {showRightHint && (
                    <div
                      className="pointer-events-none absolute top-6 left-6 rotate-[-14deg] rounded-xl border-2 border-primary bg-background/90 px-4 py-1.5 text-lg font-black tracking-wider text-primary"
                      style={{ opacity: overlayOpacity }}
                    >
                      DALŠÍ
                    </div>
                  )}
                  {showLeftHint && (
                    <div
                      className="pointer-events-none absolute top-6 right-6 rotate-[14deg] rounded-xl border-2 border-red-500 bg-background/90 px-4 py-1.5 text-lg font-black tracking-wider text-red-500"
                      style={{ opacity: overlayOpacity }}
                    >
                      ♥ ULOŽIT
                    </div>
                  )}
                </ShuffleCard>
              </div>

              {addedFlash && (
                <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center">
                  <div className="rounded-full bg-background/95 px-5 py-2.5 text-sm font-semibold shadow-xl backdrop-blur-sm animate-in fade-in zoom-in">
                    {addedFlash === "cart" ? (
                      <span className="inline-flex items-center gap-2 text-foreground">
                        <Check className="size-4 text-primary" />
                        Přidáno do košíku
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-foreground">
                        <Heart className="size-4 fill-red-500 text-red-500" />
                        Uloženo do oblíbených
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {current && !loading && (
          <div className="mt-6 flex items-center justify-center gap-5">
            <ActionButton
              onClick={handleWishlistSwipe}
              label="Do oblíbených"
              size="md"
              tone="rose"
            >
              <Heart
                className={`size-6 ${
                  hasWishlist(current.id) ? "fill-red-500 text-red-500" : ""
                }`}
              />
            </ActionButton>

            <ActionButton
              onClick={handleShuffle}
              label="Další náhodný kousek"
              size="lg"
              tone="primary"
              pulse
            >
              <Shuffle className="size-8" />
            </ActionButton>

            <ActionButton
              onClick={handleAddToCart}
              label="Přidat do košíku"
              size="md"
              tone="sage"
              disabled={adding}
            >
              {adding ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <ShoppingBag className="size-6" />
              )}
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  exhausted,
  onReset,
}: {
  exhausted: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 p-8 text-center">
      <Sparkles className="mb-4 size-10 text-primary" />
      <h2 className="mb-2 text-xl font-semibold">
        {exhausted ? "Viděla jsi všechno! 🎉" : "Žádné kousky"}
      </h2>
      <p className="mb-6 max-w-xs text-sm text-muted-foreground">
        {exhausted
          ? "Prošla jsi celý sklad. Začít znovu a objevovat od začátku?"
          : "Zkus to za chvíli znovu."}
      </p>
      {exhausted && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-transform active:scale-95"
        >
          <Shuffle className="size-4" />
          Začít znovu
        </button>
      )}
    </div>
  );
}

function ShuffleCard({
  product,
  children,
  peek = false,
  className = "",
  onProductClick,
}: {
  product: ShuffleProduct;
  children?: React.ReactNode;
  peek?: boolean;
  className?: string;
  onProductClick?: () => void;
}) {
  const img = product.images[0];
  const discount =
    product.compareAt && product.compareAt > product.price
      ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
      : 0;
  const sizes = parseJsonStringArray(product.sizes);
  const conditionLabel = CONDITION_LABELS[product.condition] ?? product.condition;
  const conditionColor = CONDITION_COLORS[product.condition] ?? "bg-muted text-foreground";

  return (
    <div
      className={`relative size-full overflow-hidden rounded-3xl bg-muted shadow-xl ring-1 ring-black/5 ${className}`}
    >
      {img ? (
        <Image
          src={img}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, 448px"
          className="object-cover"
          priority={!peek}
          draggable={false}
          unoptimized
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          Bez obrázku
        </div>
      )}

      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${conditionColor}`}
        >
          {conditionLabel}
        </span>
        {discount > 0 && (
          <span className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
            -{discount}%
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16 text-white">
        {product.brand && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider opacity-90">
            {product.brand}
          </p>
        )}
        <Link
          href={`/products/${product.slug}`}
          className="block text-lg font-bold leading-tight hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onProductClick?.();
          }}
        >
          {product.name}
        </Link>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black">{formatPrice(product.price)}</span>
            {product.compareAt && product.compareAt > product.price && (
              <span className="text-sm text-white/60 line-through">
                {formatPrice(product.compareAt)}
              </span>
            )}
          </div>
          {sizes.length > 0 && (
            <span className="rounded-md bg-white/20 px-2 py-1 text-xs font-semibold backdrop-blur-sm">
              {sizes.join(" · ")}
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-white/70">{product.categoryName}</p>
      </div>

      {children}
    </div>
  );
}

function ActionButton({
  onClick,
  children,
  label,
  size,
  tone,
  disabled,
  pulse,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  size: "md" | "lg";
  tone: "primary" | "rose" | "sage";
  disabled?: boolean;
  pulse?: boolean;
}) {
  const sizeCls = size === "lg" ? "size-[72px]" : "size-14";
  const toneCls =
    tone === "primary"
      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
      : tone === "rose"
        ? "bg-background text-red-500 ring-2 ring-red-200 shadow-md"
        : "bg-background text-emerald-600 ring-2 ring-emerald-200 shadow-md";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex ${sizeCls} items-center justify-center rounded-full transition-transform duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 ${toneCls} ${
        pulse ? "hover:scale-105" : ""
      }`}
    >
      {children}
    </button>
  );
}
