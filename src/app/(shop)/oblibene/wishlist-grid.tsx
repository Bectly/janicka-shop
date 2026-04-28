"use client";

import { useTransition } from "react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { WishlistCard } from "@/components/shop/wishlist-card";
import { WishlistEmpty } from "@/components/shop/wishlist-empty";
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
    return <WishlistEmpty />;
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p) => (
        <WishlistCard
          key={p.id}
          product={p}
          onRemove={handleRemove}
          removeDisabled={pending}
        />
      ))}
    </div>
  );
}
