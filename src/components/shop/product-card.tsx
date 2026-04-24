import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS, COLOR_MAP, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { getImageUrls } from "@/lib/images";
import { cn } from "@/lib/utils";
import { WishlistButton } from "./wishlist-button";
import { QuickViewButton } from "./quick-view-modal";
import { Flame, Truck } from "lucide-react";

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWUwZGIiLz48L3N2Zz4=";

/** Format how long ago a product was added — returns null for items older than 7 days */
function formatTimeElapsed(date: Date | string): string | null {
  const created = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - created.getTime();
  if (diffMs < 0) return null;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Právě přidáno";
  if (diffHours < 24) return `Před ${diffHours}h`;
  if (diffDays < 7) return `Před ${diffDays}d`;
  return null;
}

interface ProductCardProps {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt?: number | null;
  images: string;
  categoryName: string;
  brand?: string | null;
  condition?: string;
  sizes?: string;
  colors?: string;
  stock?: number;
  createdAt?: Date | string;
  isReserved?: boolean;
  lowestPrice30d?: number | null;
  /** Pass true for above-the-fold cards (first 4) to preload with high priority — improves LCP */
  priority?: boolean;
  /** Card display variant — "featured" cards are larger with text overlaid on image */
  variant?: "standard" | "featured";
}

export function ProductCard({
  id,
  name,
  slug,
  price,
  compareAt,
  images,
  categoryName,
  brand,
  condition,
  sizes,
  colors,
  stock = 1,
  createdAt,
  isReserved,
  lowestPrice30d,
  priority = false,
  variant = "standard",
}: ProductCardProps) {
  const hasDiscount = compareAt && compareAt > price;
  const discountPercent = hasDiscount
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : 0;

  const parsedImages = getImageUrls(images);
  const mainImage = parsedImages[0];
  const secondImage = parsedImages[1];

  let parsedSizes: string[] = [];
  let parsedColors: string[] = [];
  try { if (sizes) parsedSizes = JSON.parse(sizes); } catch { /* */ }
  try { if (colors) parsedColors = JSON.parse(colors); } catch { /* */ }

  const isFeatured = variant === "featured";

  /* ---------- Badges (shared between variants) ---------- */
  const badges = (
    <div className="absolute left-3 top-3 flex flex-col gap-1">
      {createdAt && (() => {
        const label = formatTimeElapsed(createdAt);
        if (!label) return null;
        return (
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
            {label}
          </span>
        );
      })()}
      {hasDiscount && (
        <span className="rounded-full bg-destructive/90 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
          -{discountPercent} %
        </span>
      )}
      {condition && (
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm",
            CONDITION_COLORS[condition] ?? "bg-muted text-muted-foreground",
          )}
        >
          {CONDITION_LABELS[condition] ?? condition}
        </span>
      )}
      {isReserved && (
        <span className="rounded-full bg-champagne px-2.5 py-0.5 text-xs font-medium text-brand-dark shadow-sm">
          Rezervováno
        </span>
      )}
      {/* #80 skryto per Janička — zakomentovat, nemazat
      {stock === 1 && !isReserved && (
        <span className="flex items-center gap-0.5 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
          <Flame className="size-3" />
          Poslední kus
        </span>
      )}
      */}
    </div>
  );

  /* ---------- Image block (shared between variants) ---------- */
  const imageBlock = mainImage ? (
    <>
      <Image
        src={mainImage}
        alt={name}
        fill
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        sizes={isFeatured
          ? "(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 50vw"
          : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        }
        priority={priority}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
      />
      {secondImage && (
        <Image
          src={secondImage}
          alt={`${name} — detail`}
          fill
          className="object-cover opacity-0 transition-all duration-700 ease-out group-hover:opacity-100 group-hover:scale-105"
          sizes={isFeatured
            ? "(max-width: 640px) 100vw, (max-width: 1024px) 66vw, 50vw"
            : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          }
        />
      )}
    </>
  ) : (
    <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
      <span className={cn("text-muted-foreground/30", isFeatured ? "text-5xl" : "text-3xl")}>
        {name.charAt(0)}
      </span>
    </div>
  );

  /* ==================== FEATURED VARIANT ==================== */
  if (isFeatured) {
    return (
      <Link href={`/products/${slug}`} className="group relative block transition-all duration-500 ease-out hover:-translate-y-2 haptic-press">
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] transition-all duration-500 ease-out group-hover:shadow-[0_24px_60px_-12px_rgba(180,130,140,0.25)]">
          {imageBlock}

          {/* Action buttons — revealed on hover (always visible on touch) */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 transition-all duration-300 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 card-actions-touch-reveal">
            <WishlistButton productId={id} />
            <QuickViewButton productId={id} />
          </div>

          {badges}

          {/* Editorial gradient overlay with product info */}
          <div className="absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-black/65 via-black/35 to-transparent px-5 pt-24 pb-5 transition-all duration-500 group-hover:from-black/75 group-hover:via-black/45">
            <div className="flex items-center gap-1.5">
              {brand && (
                <span className="text-[11px] font-semibold tracking-[0.12em] text-white/90 uppercase">{brand}</span>
              )}
              {brand && <span className="text-white/30">&middot;</span>}
              <span className="text-[11px] font-medium text-white/60">{categoryName}</span>
            </div>
            <h3 className="mt-2 text-base font-semibold leading-snug text-white sm:text-lg">
              {name}
            </h3>
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="text-lg font-bold tracking-tight text-white">{formatPrice(price)}</span>
              {hasDiscount && (
                <span className="text-sm text-white/40 line-through">{formatPrice(compareAt)}</span>
              )}
            </div>
            {hasDiscount && lowestPrice30d != null && (
              <p className="mt-0.5 text-[10px] text-white/40">
                Nejnižší cena za 30 dní: {formatPrice(lowestPrice30d)}
              </p>
            )}
            {price >= FREE_SHIPPING_THRESHOLD && (
              <p className="mt-0.5 text-[10px] font-medium text-champagne">
                Doprava zdarma
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  /* ==================== STANDARD VARIANT ==================== */
  return (
    <Link href={`/products/${slug}`} className="group block transition-all duration-500 ease-out hover:-translate-y-2 haptic-press">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-muted shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] transition-all duration-500 ease-out group-hover:shadow-[0_20px_50px_-12px_rgba(180,130,140,0.22)]">
        {imageBlock}

        {/* Action buttons — revealed on hover (always visible on touch) */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 transition-all duration-300 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 card-actions-touch-reveal">
          <WishlistButton productId={id} />
          <QuickViewButton productId={id} />
        </div>

        {badges}

        {/* Subtle hover gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      </div>
      <div className="mt-3 space-y-0.5">
        <div className="flex items-center gap-1.5">
          {brand && (
            <p className="text-[11px] font-semibold tracking-[0.1em] text-primary/70 uppercase">
              {brand}
            </p>
          )}
          {brand && <span className="text-[10px] text-muted-foreground/30">&middot;</span>}
          <p className="text-[11px] text-muted-foreground/60">{categoryName}</p>
        </div>
        <h3 className="text-sm font-medium leading-snug text-foreground/90 transition-colors duration-150 line-clamp-1 group-hover:text-primary">
          {name}
        </h3>
        <div className="flex items-baseline gap-2 pt-0.5">
          <span className="text-sm font-bold tracking-tight">{formatPrice(price)}</span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground/50 line-through">
              {formatPrice(compareAt)}
            </span>
          )}
        </div>
        {hasDiscount && lowestPrice30d != null && (
          <p className="text-[10px] leading-tight text-muted-foreground/70">
            Nejnižší cena za 30 dní: {formatPrice(lowestPrice30d)}
          </p>
        )}
        {price >= FREE_SHIPPING_THRESHOLD && (
          <div className="flex items-center gap-1">
            <Truck className="size-3 text-sage-dark" />
            <p className="text-[10px] font-medium leading-tight text-sage-dark">
              Doprava zdarma
            </p>
          </div>
        )}
        {/* Size & color indicators */}
        {(parsedSizes.length > 0 || parsedColors.length > 0) && (
          <div className="flex items-center gap-2 pt-1">
            {parsedSizes.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {parsedSizes.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-sm bg-muted/80 px-1.5 py-px text-[10px] leading-tight text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
                {parsedSizes.length > 4 && (
                  <span className="rounded-sm bg-muted/80 px-1.5 py-px text-[10px] leading-tight text-muted-foreground">
                    +{parsedSizes.length - 4}
                  </span>
                )}
              </div>
            )}
            {parsedColors.length > 0 && (() => {
              const mappedColors = parsedColors.filter((c) => COLOR_MAP[c]);
              if (mappedColors.length === 0) return null;
              return (
                <div className="flex gap-1" role="list" aria-label="Barvy">
                  {mappedColors.slice(0, 5).map((c) => (
                    <span
                      key={c}
                      role="listitem"
                      className="size-3.5 rounded-full border border-foreground/10"
                      style={{ backgroundColor: COLOR_MAP[c] }}
                      title={c}
                      aria-label={c}
                    />
                  ))}
                  {mappedColors.length > 5 && (
                    <span className="flex size-3.5 items-center justify-center rounded-full bg-muted text-[9px] font-medium text-muted-foreground">
                      +{mappedColors.length - 5}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </Link>
  );
}
