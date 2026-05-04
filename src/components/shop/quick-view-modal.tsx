"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Loader2, ArrowRight, Sparkles, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { AddToCartButton } from "./add-to-cart-button";
import { getImageUrls } from "@/lib/images";
import { WishlistButton } from "./wishlist-button";
import { getProductQuickView } from "@/lib/actions/products";

type QuickViewProduct = NonNullable<
  Awaited<ReturnType<typeof getProductQuickView>>
>;

interface QuickViewButtonProps {
  productId: string;
}

const MAX_QV_THUMBS = 6;

export function QuickViewButton({ productId }: QuickViewButtonProps) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<QuickViewProduct | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!open) setActiveIdx(0);
  }, [open]);
  useEffect(() => {
    setActiveIdx(0);
  }, [product?.id]);

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      if (!product) {
        startTransition(async () => {
          const data = await getProductQuickView(productId);
          if (data) setProduct(data);
        });
      }
    },
    [productId, product]
  );

  const handleClose = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen(false);
  }, []);

  // Stops events bubbling from the Dialog portal (X button, backdrop click,
  // close buttons) through React's synthetic event tree to the parent <Link>
  // that wraps <ProductCard>, which would otherwise navigate to the PDP.
  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <span
      style={{ display: "contents" }}
      onClick={stopPropagation}
      onPointerDown={stopPropagation}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex size-11 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all ease-out-expo duration-snap hover:bg-background hover:shadow-card-hover active:scale-95 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:opacity-100 focus-visible:translate-y-0"
        aria-label="Rychlý náhled"
      >
        <Eye className="size-4 text-foreground/70" />
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className="fixed inset-0 z-50 modal-backdrop-warm supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-soft"
          />
          <DialogPrimitive.Popup
            data-slot="quick-view-popup"
            onClick={stopPropagation}
            className={cn(
              "fixed left-1/2 top-1/2 z-50 outline-none",
              // sizing — full-screen sheet on mobile, editorial card on desktop
              "w-[calc(100vw-1rem)] sm:w-auto sm:max-w-modal-md lg:max-w-modal-lg",
              "max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]",
              // shape + surface
              "overflow-hidden rounded-3xl sm:rounded-modal bg-blush-light",
              "shadow-modal-elevated ring-1 ring-foreground/[0.04]",
              // entrance
              "-translate-x-1/2 -translate-y-1/2",
              "data-open:animate-modal-rise-in data-closed:animate-modal-rise-out"
            )}
          >
            {/* Hidden floating close — pill chip top-right outside content padding */}
            <DialogPrimitive.Close
              className="absolute right-3 top-3 z-30 inline-flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground/70 backdrop-blur-md ring-1 ring-foreground/10 transition-all ease-out-expo duration-snap hover:bg-background hover:text-foreground hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Zavřít náhled"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>

            {isPending || !product ? (
              <QuickViewLoading />
            ) : product.sold ? (
              <SoldState product={product} onClose={handleClose} />
            ) : (
              <QuickViewBody
                product={product}
                activeIdx={activeIdx}
                setActiveIdx={setActiveIdx}
                onClose={handleClose}
              />
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </span>
  );
}

/* ---------- Loading skeleton ---------- */

function QuickViewLoading() {
  return (
    <div className="flex min-h-modal-content-min items-center justify-center p-stack">
      <DialogPrimitive.Title className="sr-only">Načítám náhled</DialogPrimitive.Title>
      <div className="flex flex-col items-center gap-stack-sm text-muted-foreground">
        <Loader2 className="size-7 animate-spin text-brand/70" />
        <p className="text-eyebrow">Připravuji kousek</p>
      </div>
    </div>
  );
}

/* ---------- Sold state ---------- */

function SoldState({
  product,
  onClose,
}: {
  product: QuickViewProduct;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-modal-content-min flex-col items-center justify-center p-stack-lg text-center">
      <DialogPrimitive.Title className="font-heading text-2xl font-semibold text-foreground">
        Tenhle kousek už našel domov
      </DialogPrimitive.Title>
      <DialogPrimitive.Description className="mt-3 max-w-sm text-tagline-italic">
        Každý kus je u nás unikát. Tenhle už si někdo odnesl, ale podobné poklady ještě čekají.
      </DialogPrimitive.Description>
      <Link
        href={`/products/${product.slug}`}
        onClick={onClose}
        className="mt-stack inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all ease-out-expo duration-soft hover:bg-brand-dark hover:shadow-glow-brand"
      >
        Zobrazit detail
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

/* ---------- Main body — image + info, editorial 2-col ---------- */

function QuickViewBody({
  product,
  activeIdx,
  setActiveIdx,
  onClose,
}: {
  product: QuickViewProduct;
  activeIdx: number;
  setActiveIdx: (idx: number) => void;
  onClose: () => void;
}) {
  const images = getImageUrls(product.images);

  let sizes: string[] = [];
  let colors: string[] = [];
  try {
    sizes = JSON.parse(product.sizes);
  } catch {
    /* fallback */
  }
  try {
    colors = JSON.parse(product.colors);
  } catch {
    /* fallback */
  }

  const hasDiscount = !!product.compareAt && product.compareAt > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAt! - product.price) / product.compareAt!) * 100)
    : 0;

  return (
    <div className="grid h-full max-h-[inherit] grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
      {/* ─────────── Gallery ─────────── */}
      <div className="relative flex flex-col bg-blush">
        {/* Main image */}
        <Link
          href={`/products/${product.slug}`}
          onClick={onClose}
          className="group/main relative block aspect-portrait w-full overflow-hidden bg-muted lg:aspect-auto lg:flex-1 lg:min-h-modal-gallery-min"
        >
          {images[activeIdx] ? (
            <Image
              key={`qv-main-${activeIdx}`}
              src={images[activeIdx]}
              alt={
                activeIdx === 0
                  ? product.name
                  : `${product.name} — foto ${activeIdx + 1}`
              }
              fill
              className="animate-image-cross-fade object-cover transition-transform ease-out-expo duration-sublime group-hover/main:scale-[1.03]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 560px"
              unoptimized
              priority
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="font-heading text-7xl text-foreground/15">
                {product.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Discount badge — soft brand-pink chip top-left */}
          {hasDiscount && (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-brand/95 px-3 py-1 text-xs font-semibold tracking-wide text-primary-foreground shadow-card-hover backdrop-blur-sm">
              <Sparkles className="size-3" />−{discountPercent} %
            </span>
          )}

          {/* Wishlist — floating glass chip top-right of image */}
          <div className="absolute right-4 top-4 z-10">
            <WishlistButton productId={product.id} variant="card" />
          </div>

          {/* Image count indicator — bottom-right pill */}
          {images.length > 1 && (
            <span className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1 rounded-full bg-charcoal/55 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-white/95 backdrop-blur-sm">
              {activeIdx + 1} / {Math.min(images.length, MAX_QV_THUMBS)}
            </span>
          )}
        </Link>

        {/* Thumb strip — horizontal under image, soft rail */}
        {images.length > 1 && (
          <div
            className="flex shrink-0 items-center gap-2 overflow-x-auto scrollbar-none px-4 py-3"
            role="tablist"
            aria-label="Fotky produktu"
          >
            {images.slice(0, MAX_QV_THUMBS).map((url, i) => {
              const isActive = i === activeIdx;
              return (
                <button
                  key={`qv-thumb-${url}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Zobrazit foto ${i + 1}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIdx(i);
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  onFocus={() => setActiveIdx(i)}
                  className={cn(
                    "relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted transition-all ease-out-expo duration-snap focus-visible:outline-none",
                    "ring-offset-2 ring-offset-blush",
                    isActive
                      ? "ring-2 ring-brand scale-100"
                      : "ring-1 ring-foreground/10 hover:ring-brand/40 opacity-70 hover:opacity-100"
                  )}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────── Info panel ─────────── */}
      <div className="relative flex flex-col overflow-y-auto bg-blush-light">
        {/* Soft top fade for scroll affordance */}
        <div className="pointer-events-none sticky top-0 z-10 h-4 -mb-4 bg-gradient-to-b from-blush-light to-transparent" />

        <div className="flex-1 px-6 pb-6 pt-7 sm:px-8 sm:pt-9 lg:pr-10">
          {/* Eyebrow — category · brand */}
          <DialogPrimitive.Description className="text-eyebrow flex items-center gap-2 text-foreground/55">
            <span>{product.categoryName}</span>
            {product.brand && (
              <>
                <span aria-hidden="true" className="size-1 rounded-full bg-foreground/25" />
                <span className="text-brand-dark">{product.brand}</span>
              </>
            )}
          </DialogPrimitive.Description>

          {/* Title — serif, generous size */}
          <DialogPrimitive.Title className="mt-3 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-[1.75rem]">
            {product.name}
          </DialogPrimitive.Title>

          {/* Italic tagline — only when description is rich enough to warrant it */}
          {product.description && product.description.length > 30 && (
            <p className="mt-3 line-clamp-3 text-tagline-italic">
              {product.description}
            </p>
          )}

          {/* Price block */}
          <div className="mt-stack flex items-end gap-3 border-t border-foreground/[0.06] pt-stack-sm">
            <span className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="pb-1 text-base text-muted-foreground/70 line-through decoration-foreground/30">
                {formatPrice(product.compareAt!)}
              </span>
            )}
          </div>

          {/* Pills — condition + unique badge */}
          <div className="mt-stack-sm flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                CONDITION_COLORS[product.condition] ??
                  "bg-muted text-muted-foreground"
              )}
            >
              {CONDITION_LABELS[product.condition] ?? product.condition}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand-dark ring-1 ring-brand/15">
              <Sparkles className="size-3" />
              Jediný kus
            </span>
            {sizes.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-3 py-1 text-xs font-medium text-foreground/75 ring-1 ring-foreground/[0.06]">
                Velikost <span className="font-semibold text-foreground">{sizes[0]}</span>
              </span>
            )}
          </div>

          {/* Add to cart — full add-to-cart-button respects size/color logic */}
          <div className="-mt-2">
            <AddToCartButton
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
                slug: product.slug,
                images: product.images,
                sizes,
                colors,
                stock: product.stock,
                reservedUntil: product.reservedUntil,
              }}
            />
          </div>

          {/* Footer — subtle PDP link */}
          <div className="mt-stack flex items-center justify-between border-t border-foreground/[0.06] pt-stack-sm">
            <span className="text-eyebrow text-foreground/45">
              Náhled
            </span>
            <Link
              href={`/products/${product.slug}`}
              onClick={onClose}
              className="group/pdp inline-flex items-center gap-1.5 text-sm font-medium text-brand-dark transition-colors ease-out-expo duration-snap hover:text-brand focus-visible:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-blush-light"
            >
              Celý detail
              <ArrowRight className="size-3.5 transition-transform ease-out-expo duration-snap group-hover/pdp:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
