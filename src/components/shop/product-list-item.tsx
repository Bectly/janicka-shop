import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS, COLOR_MAP, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { getImageUrls } from "@/lib/images";
import { cn } from "@/lib/utils";
import { WishlistButton } from "./wishlist-button";
import { Flame } from "lucide-react";

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlNWUwZGIiLz48L3N2Zz4=";

interface ProductListItemProps {
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
  priority?: boolean;
}

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

export function ProductListItem({
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
}: ProductListItemProps) {
  const hasDiscount = compareAt && compareAt > price;
  const discountPercent = hasDiscount
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : 0;

  const parsedImages = getImageUrls(images);
  const mainImage = parsedImages[0];

  let parsedSizes: string[] = [];
  let parsedColors: string[] = [];
  try { if (sizes) parsedSizes = JSON.parse(sizes); } catch { /* */ }
  try { if (colors) parsedColors = JSON.parse(colors); } catch { /* */ }

  const timeLabel = createdAt ? formatTimeElapsed(createdAt) : null;

  return (
    <Link
      href={`/products/${slug}`}
      className="group flex gap-4 rounded-2xl border bg-card p-3 transition-all hover:border-primary/20 hover:shadow-md sm:gap-5 sm:p-4"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:w-36">
        {mainImage ? (
          <Image
            src={mainImage}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 112px, 144px"
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <span className="text-2xl text-muted-foreground/30">{name.charAt(0)}</span>
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          {hasDiscount && (
            <span className="rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-semibold text-white">
              -{discountPercent} %
            </span>
          )}
          {stock === 1 && !isReserved && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              <Flame className="size-2.5" />
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          {/* Category + brand row */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{categoryName}</span>
            {brand && (
              <>
                <span className="text-xs text-muted-foreground/40">&middot;</span>
                <span className="text-xs font-semibold tracking-wide text-primary/70 uppercase">
                  {brand}
                </span>
              </>
            )}
          </div>

          {/* Name */}
          <h3 className="mt-1 text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2 sm:text-base">
            {name}
          </h3>

          {/* Condition + time badges */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {condition && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  CONDITION_COLORS[condition] ?? "bg-muted text-muted-foreground",
                )}
              >
                {CONDITION_LABELS[condition] ?? condition}
              </span>
            )}
            {timeLabel && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {timeLabel}
              </span>
            )}
            {isReserved && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
                Rezervováno
              </span>
            )}
          </div>

          {/* Sizes + colors */}
          {(parsedSizes.length > 0 || parsedColors.length > 0) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {parsedSizes.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {parsedSizes.slice(0, 6).map((s) => (
                    <span
                      key={s}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                  {parsedSizes.length > 6 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground">
                      +{parsedSizes.length - 6}
                    </span>
                  )}
                </div>
              )}
              {parsedColors.length > 0 && (() => {
                const mappedColors = parsedColors.filter((c) => COLOR_MAP[c]);
                if (mappedColors.length === 0) return null;
                return (
                  <div className="flex gap-0.5">
                    {mappedColors.slice(0, 6).map((c) => (
                      <span
                        key={c}
                        className="size-3.5 rounded-full border border-foreground/10"
                        style={{ backgroundColor: COLOR_MAP[c] }}
                        title={c}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Price + actions */}
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold sm:text-lg">{formatPrice(price)}</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(compareAt)}
                </span>
              )}
            </div>
            {hasDiscount && lowestPrice30d != null && (
              <p className="text-[10px] text-muted-foreground">
                Nejnižší cena za 30 dní: {formatPrice(lowestPrice30d)}
              </p>
            )}
            {price >= FREE_SHIPPING_THRESHOLD && (
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Doprava zdarma
              </p>
            )}
          </div>
          <div className="shrink-0">
            <WishlistButton productId={id} />
          </div>
        </div>
      </div>
    </Link>
  );
}
