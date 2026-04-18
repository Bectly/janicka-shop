"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { useWishlistStore } from "@/lib/wishlist-store";
import { getImageUrls } from "@/lib/images";
import { removeFromWishlist } from "./actions";

export type WishlistRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  images: string;
  brand: string | null;
  condition: string;
  categoryName: string;
  categorySlug: string;
  sold: boolean;
};

interface Props {
  items: WishlistRow[];
}

export function WishlistGrid({ items }: Props) {
  const [pending, startTransition] = useTransition();
  const toggleLocal = useWishlistStore((s) => s.toggle);
  const hasLocal = useWishlistStore((s) => s.has);

  function handleRemove(productId: string) {
    startTransition(async () => {
      await removeFromWishlist(productId);
      if (hasLocal(productId)) toggleLocal(productId);
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/40 p-10 text-center">
        <Heart className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">
          Zatím sis nic neuložila do oblíbených.
        </p>
        <Button render={<Link href="/novinky" />} className="mt-4">
          Prohlédnout novinky
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
      {items.map((p) => {
        const imgs = getImageUrls(p.images);
        const mainImage = imgs[0];
        const hasDiscount = p.compareAt && p.compareAt > p.price;
        const discountPct = hasDiscount
          ? Math.round(((p.compareAt! - p.price) / p.compareAt!) * 100)
          : 0;

        return (
          <div key={p.id} className="group relative">
            <Link
              href={p.sold ? `/collections/${p.categorySlug}` : `/products/${p.slug}`}
              className="block"
            >
              <div
                className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-muted ${
                  p.sold ? "opacity-60 grayscale" : ""
                }`}
              >
                {mainImage ? (
                  <Image
                    src={mainImage}
                    alt={p.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <span className="text-3xl text-muted-foreground/30">
                      {p.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {p.sold && (
                    <span className="rounded-md bg-foreground/80 px-2 py-0.5 text-xs font-semibold text-background">
                      Už prodáno
                    </span>
                  )}
                  {hasDiscount && !p.sold && (
                    <span className="rounded-md bg-destructive/90 px-2 py-0.5 text-xs font-semibold text-white">
                      -{discountPct} %
                    </span>
                  )}
                  {p.condition && !p.sold && (
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        CONDITION_COLORS[p.condition] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {CONDITION_LABELS[p.condition] ?? p.condition}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground">{p.categoryName}</p>
                  {p.brand && (
                    <>
                      <span className="text-xs text-muted-foreground/50">&middot;</span>
                      <p className="text-xs font-medium text-muted-foreground">{p.brand}</p>
                    </>
                  )}
                </div>
                <h3
                  className={`text-sm font-medium leading-snug ${
                    p.sold
                      ? "text-muted-foreground line-through"
                      : "text-foreground group-hover:text-primary"
                  }`}
                >
                  {p.name}
                </h3>
                {!p.sold && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatPrice(p.price)}</span>
                    {hasDiscount && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(p.compareAt!)}
                      </span>
                    )}
                  </div>
                )}
                {p.sold && (
                  <p className="text-xs text-muted-foreground">
                    Už prodáno — podívej se na podobné →
                  </p>
                )}
              </div>
            </Link>
            <button
              type="button"
              onClick={() => handleRemove(p.id)}
              disabled={pending}
              className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all hover:bg-background hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
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
