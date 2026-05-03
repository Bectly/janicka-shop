"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { getImageUrls } from "@/lib/images";

export type WishlistCardProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  images: string;
  brand: string | null;
  condition: string;
  categoryName: string;
  /** Optional — when present, sold items deep-link to category for similar items. */
  categorySlug?: string;
  sold: boolean;
};

interface WishlistCardProps {
  product: WishlistCardProduct;
  onRemove: (productId: string) => void;
  removeDisabled?: boolean;
}

export function WishlistCard({ product, onRemove, removeDisabled }: WishlistCardProps) {
  const parsedImages = getImageUrls(product.images);
  const mainImage = parsedImages[0];
  const hasDiscount = product.compareAt && product.compareAt > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.compareAt! - product.price) / product.compareAt!) * 100)
    : 0;

  const href = product.sold && product.categorySlug
    ? `/collections/${product.categorySlug}`
    : `/products/${product.slug}`;

  return (
    <div className="group relative">
      <Link href={href} className="block">
        <div
          className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-muted ${
            product.sold ? "opacity-60 grayscale" : ""
          }`}
        >
          {mainImage ? (
            <Image
              src={mainImage}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <span className="text-3xl text-muted-foreground/30">
                {product.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.sold && (
              <span className="rounded-md bg-foreground/80 px-2 py-0.5 text-xs font-semibold text-background">
                Prodáno
              </span>
            )}
            {hasDiscount && !product.sold && (
              <span className="rounded-md bg-destructive/90 px-2 py-0.5 text-xs font-semibold text-white">
                -{discountPercent} %
              </span>
            )}
            {product.condition && !product.sold && (
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                  CONDITION_COLORS[product.condition] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {CONDITION_LABELS[product.condition] ?? product.condition}
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{product.categoryName}</p>
            {product.brand && (
              <>
                <span className="text-xs text-muted-foreground/50">&middot;</span>
                <p className="text-xs font-medium text-muted-foreground">{product.brand}</p>
              </>
            )}
          </div>
          <h3
            className={`text-sm font-medium leading-snug transition-colors duration-200 ${
              product.sold
                ? "text-muted-foreground line-through"
                : "text-foreground group-hover:text-primary"
            }`}
          >
            {product.name}
          </h3>
          {!product.sold && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{formatPrice(product.price)}</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(product.compareAt!)}
                </span>
              )}
            </div>
          )}
          {product.sold && (
            <p className="text-xs text-muted-foreground">
              {product.categorySlug
                ? "Už prodáno — podívej se na podobné →"
                : "Tento kousek už má novou majitelku"}
            </p>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onRemove(product.id)}
        disabled={removeDisabled}
        className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all duration-200 hover:bg-background hover:shadow-md active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Odebrat z oblíbených"
      >
        <Heart className="size-4 fill-red-500 text-red-500" />
      </button>
    </div>
  );
}

export function WishlistCardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
      <div className="space-y-1.5">
        <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
