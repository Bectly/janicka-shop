"use client";

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, Loader2, ArrowRight, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

export function QuickViewButton({ productId }: QuickViewButtonProps) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<QuickViewProduct | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const images = product ? getImageUrls(product.images) : [];

  let sizes: string[] = [];
  let colors: string[] = [];
  if (product) {
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
  }

  const hasDiscount =
    product?.compareAt && product.compareAt > product.price;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex size-11 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all hover:bg-background hover:shadow-md opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 duration-200"
        aria-label="Rychlý náhled"
      >
        <Eye className="size-4 text-foreground/70" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {isPending || !product ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : product.sold ? (
            <div className="py-8 text-center">
              <p className="text-lg font-medium text-foreground">
                Tento kousek je již prodán
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Každý náš kousek je unikát. Podívejte se na podobné.
              </p>
              <Link
                href={`/products/${product.slug}`}
                onClick={handleClose}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Zobrazit detail
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Image */}
              <Link
                href={`/products/${product.slug}`}
                onClick={handleClose}
                className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted"
              >
                {images[0] ? (
                  <Image
                    src={images[0]}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-105"
                    sizes="(max-width: 640px) 90vw, 300px"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <span className="text-3xl text-muted-foreground/30">
                      {product.name.charAt(0)}
                    </span>
                  </div>
                )}
                {hasDiscount && (
                  <span className="absolute top-2 left-2 rounded-md bg-destructive/90 px-2 py-0.5 text-xs font-semibold text-white">
                    -
                    {Math.round(
                      ((product.compareAt! - product.price) /
                        product.compareAt!) *
                        100
                    )}{" "}
                    %
                  </span>
                )}
              </Link>

              {/* Info */}
              <div className="flex flex-col">
                <DialogDescription className="flex items-center gap-1.5 text-xs">
                  <span>{product.categoryName}</span>
                  {product.brand && (
                    <>
                      <span className="text-muted-foreground/50">
                        &middot;
                      </span>
                      <span className="font-medium">{product.brand}</span>
                    </>
                  )}
                </DialogDescription>

                <DialogTitle className="mt-1 font-heading text-lg leading-snug">
                  {product.name}
                </DialogTitle>

                {/* Price */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold text-foreground">
                    {formatPrice(product.price)}
                  </span>
                  {hasDiscount && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.compareAt!)}
                    </span>
                  )}
                </div>

                {/* Condition + scarcity */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${CONDITION_COLORS[product.condition] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {CONDITION_LABELS[product.condition] ?? product.condition}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-medium text-brand-dark">
                    <Sparkles className="size-2.5" />
                    Jediný kus
                  </span>
                </div>

                {/* Description (truncated) */}
                {product.description && (
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                )}

                {/* Add to cart */}
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

                {/* Actions row */}
                <div className="mt-3 flex items-center justify-between">
                  <WishlistButton productId={product.id} variant="detail" />
                  <Link
                    href={`/products/${product.slug}`}
                    onClick={handleClose}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Celý detail
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
