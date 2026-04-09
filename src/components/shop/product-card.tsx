import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS, COLOR_MAP, FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { getImageUrls } from "@/lib/images";
import { WishlistButton } from "./wishlist-button";
import { QuickViewButton } from "./quick-view-modal";
import { Flame } from "lucide-react";

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
  isNew?: boolean;
  isReserved?: boolean;
  lowestPrice30d?: number | null;
  /** Pass true for above-the-fold cards (first 4) to preload with high priority — improves LCP */
  priority?: boolean;
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
  isNew,
  isReserved,
  lowestPrice30d,
  priority = false,
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

  return (
    <Link href={`/products/${slug}`} className="group block transition-transform duration-300 hover:-translate-y-1.5">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-sm transition-shadow duration-300 group-hover:shadow-xl">
        {mainImage ? (
          <>
            <Image
              src={mainImage}
              alt={name}
              fill
              className="object-cover transition-all duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
            />
            {secondImage && (
              <Image
                src={secondImage}
                alt={`${name} — detail`}
                fill
                className="object-cover opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            )}
          </>
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 transition-transform duration-300 group-hover:scale-105">
            <span className="text-3xl text-muted-foreground/30">
              {name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
          <WishlistButton productId={id} />
          <QuickViewButton productId={id} />
        </div>
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isNew && (
            <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              Novinka
            </span>
          )}
          {hasDiscount && (
            <span className="rounded-md bg-destructive/90 px-2 py-0.5 text-xs font-semibold text-white">
              -{discountPercent} %
            </span>
          )}
          {condition && (
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[condition] ?? "bg-muted text-muted-foreground"}`}
            >
              {CONDITION_LABELS[condition] ?? condition}
            </span>
          )}
          {isReserved && (
            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
              Rezervováno
            </span>
          )}
          {stock === 1 && !isReserved && (
            <span className="flex items-center gap-0.5 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
              <Flame className="size-3" />
              Poslední kus
            </span>
          )}
        </div>
        {/* Hover gradient overlay with "Rychlý náhled" pill */}
        <div className="absolute inset-x-0 bottom-0 flex h-16 translate-y-full items-end justify-center bg-gradient-to-t from-black/40 to-transparent pb-3 transition-transform duration-300 group-hover:translate-y-0">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
            Rychlý náhled
          </span>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground">{categoryName}</p>
          {brand && (
            <>
              <span className="text-xs text-muted-foreground/50">&middot;</span>
              <p className="text-xs font-medium text-muted-foreground">
                {brand}
              </p>
            </>
          )}
        </div>
        <h3 className="text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors">
          {name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formatPrice(price)}</span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(compareAt)}
            </span>
          )}
        </div>
        {hasDiscount && lowestPrice30d != null && (
          <p className="text-[10px] leading-tight text-muted-foreground">
            Nejnižší cena za 30 dní: {formatPrice(lowestPrice30d)}
          </p>
        )}
        {price >= FREE_SHIPPING_THRESHOLD && (
          <p className="text-[10px] font-medium leading-tight text-emerald-600 dark:text-emerald-400">
            Doprava zdarma
          </p>
        )}
        {/* Size & color indicators */}
        {(parsedSizes.length > 0 || parsedColors.length > 0) && (
          <div className="flex items-center gap-2">
            {parsedSizes.length > 0 && (
              <div className="flex flex-wrap gap-0.5">
                {parsedSizes.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded bg-muted px-1 py-px text-[10px] leading-tight text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
                {parsedSizes.length > 4 && (
                  <span className="rounded bg-muted px-1 py-px text-[10px] leading-tight text-muted-foreground">
                    +{parsedSizes.length - 4}
                  </span>
                )}
              </div>
            )}
            {parsedColors.length > 0 && (() => {
              const mappedColors = parsedColors.filter((c) => COLOR_MAP[c]);
              if (mappedColors.length === 0) return null;
              return (
                <div className="flex gap-0.5" role="list" aria-label="Barvy">
                  {mappedColors.slice(0, 5).map((c) => (
                    <span
                      key={c}
                      role="listitem"
                      className="size-3 rounded-full border border-foreground/10"
                      style={{ backgroundColor: COLOR_MAP[c] }}
                      title={c}
                      aria-label={c}
                    />
                  ))}
                  {mappedColors.length > 5 && (
                    <span className="flex size-3 items-center justify-center rounded-full bg-muted text-[7px] text-muted-foreground">
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
