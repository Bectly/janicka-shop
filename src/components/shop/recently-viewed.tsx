"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRecentlyViewedStore } from "@/lib/recently-viewed-store";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { WishlistButton } from "./wishlist-button";

interface TrackViewProps {
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    compareAt: number | null;
    images: string;
    categoryName: string;
    brand: string | null;
    condition: string;
  };
}

/** Invisible component that tracks product views. Mount on product detail page. */
export function TrackProductView({ product }: TrackViewProps) {
  const add = useRecentlyViewedStore((s) => s.add);

  useEffect(() => {
    add(product);
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/** Displays recently viewed products, optionally excluding a given product ID. */
export function RecentlyViewedSection({
  excludeProductId,
}: {
  excludeProductId?: string;
}) {
  const getRecent = useRecentlyViewedStore((s) => s.getRecent);
  const [items, setItems] = useState<ReturnType<typeof getRecent>>([]);

  useEffect(() => {
    setItems(getRecent(excludeProductId));
  }, [excludeProductId, getRecent]);

  if (items.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="font-heading text-xl font-bold text-foreground">
        Nedávno prohlížené
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {items.slice(0, 8).map((item) => {
          let parsedImages: string[] = [];
          try {
            parsedImages = JSON.parse(item.images);
          } catch {
            /* fallback */
          }
          const mainImage = parsedImages[0];
          const hasDiscount =
            item.compareAt && item.compareAt > item.price;
          const discountPercent = hasDiscount
            ? Math.round(
                ((item.compareAt! - item.price) / item.compareAt!) * 100,
              )
            : 0;

          return (
            <Link
              key={item.id}
              href={`/products/${item.slug}`}
              className="group block"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                {mainImage ? (
                  <Image
                    src={mainImage}
                    alt={item.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                    <span className="text-3xl text-muted-foreground/30">
                      {item.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute top-2 right-2 z-10">
                  <WishlistButton productId={item.id} />
                </div>
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {hasDiscount && (
                    <span className="rounded-md bg-destructive/90 px-2 py-0.5 text-xs font-semibold text-white">
                      -{discountPercent} %
                    </span>
                  )}
                  {item.condition && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[item.condition] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {CONDITION_LABELS[item.condition] ?? item.condition}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground">
                    {item.categoryName}
                  </p>
                  {item.brand && (
                    <>
                      <span className="text-xs text-muted-foreground/50">
                        &middot;
                      </span>
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.brand}
                      </p>
                    </>
                  )}
                </div>
                <h3 className="text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
                  {item.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {formatPrice(item.price)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatPrice(item.compareAt!)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
