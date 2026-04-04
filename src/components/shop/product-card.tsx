import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { WishlistButton } from "./wishlist-button";

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
  isNew?: boolean;
  isReserved?: boolean;
  lowestPrice30d?: number | null;
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
  isNew,
  isReserved,
  lowestPrice30d,
}: ProductCardProps) {
  const hasDiscount = compareAt && compareAt > price;
  const discountPercent = hasDiscount
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : 0;

  let parsedImages: string[] = [];
  try {
    parsedImages = JSON.parse(images);
  } catch {
    /* corrupted data fallback */
  }
  const mainImage = parsedImages[0];

  return (
    <Link href={`/products/${slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
        {mainImage ? (
          <Image
            src={mainImage}
            alt={name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 transition-transform duration-300 group-hover:scale-105">
            <span className="text-3xl text-muted-foreground/30">
              {name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton productId={id} />
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
      </div>
    </Link>
  );
}
