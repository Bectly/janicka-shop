"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingBag } from "lucide-react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { getWishlistProducts, type WishlistProduct } from "./actions";
import { getImageUrls } from "@/lib/images";

const emptySubscribe = () => () => {};

export function WishlistContent() {
  const wishlistIds = useWishlistStore((s) => s.items);
  const toggle = useWishlistStore((s) => s.toggle);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch products when wishlist IDs change
  useEffect(() => {
    if (!mounted) return;

    if (wishlistIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when wishlist clears
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getWishlistProducts(wishlistIds).then((data) => {
      // Sort: available first, sold last
      const sorted = data.sort((a, b) => {
        if (a.sold !== b.sold) return a.sold ? 1 : -1;
        return 0;
      });
      setProducts(sorted);
      setLoading(false);
    }).catch(() => {
      // Show empty state on error instead of infinite loading
      setLoading(false);
    });
  }, [wishlistIds, mounted]);

  if (!mounted || loading) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Načítám oblíbené...</p>
      </div>
    );
  }

  if (wishlistIds.length === 0) {
    return (
      <div className="py-20 text-center">
        <Heart className="mx-auto size-12 text-muted-foreground/30" />
        <p className="mt-4 text-lg text-muted-foreground">
          Zatím nemáte žádné oblíbené kousky
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Klikněte na srdíčko u produktu a přidejte si ho sem
        </p>
        <Button className="mt-6" render={<Link href="/products" />}>
          <ShoppingBag className="mr-2 size-4" />
          Prohlédnout kolekci
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => {
        const parsedImages = getImageUrls(product.images);
        const mainImage = parsedImages[0];
        const hasDiscount =
          product.compareAt && product.compareAt > product.price;
        const discountPercent = hasDiscount
          ? Math.round(
              ((product.compareAt! - product.price) / product.compareAt!) * 100
            )
          : 0;

        return (
          <div key={product.id} className="group relative">
            <Link
              href={`/products/${product.slug}`}
              className="block"
            >
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
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                    <span className="text-3xl text-muted-foreground/30">
                      {product.name.charAt(0)}
                    </span>
                  </div>
                )}
                {/* Badges */}
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
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[product.condition] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {CONDITION_LABELS[product.condition] ?? product.condition}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground">
                    {product.categoryName}
                  </p>
                  {product.brand && (
                    <>
                      <span className="text-xs text-muted-foreground/50">
                        &middot;
                      </span>
                      <p className="text-xs font-medium text-muted-foreground">
                        {product.brand}
                      </p>
                    </>
                  )}
                </div>
                <h3
                  className={`text-sm font-medium leading-snug transition-colors ${
                    product.sold
                      ? "text-muted-foreground line-through"
                      : "text-foreground group-hover:text-primary"
                  }`}
                >
                  {product.name}
                </h3>
                {!product.sold && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {formatPrice(product.price)}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(product.compareAt!)}
                      </span>
                    )}
                  </div>
                )}
                {product.sold && (
                  <p className="text-xs text-muted-foreground">
                    Tento kousek už má novou majitelku
                  </p>
                )}
              </div>
            </Link>
            {/* Remove from wishlist */}
            <button
              type="button"
              onClick={() => toggle(product.id)}
              className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all hover:bg-background hover:shadow-md"
              aria-label="Odebrat z oblíbených"
            >
              <Heart className="size-4 fill-red-500 text-red-500" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
