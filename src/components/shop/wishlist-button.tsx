"use client";

import { Heart } from "lucide-react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useSyncExternalStore, useCallback, useState } from "react";

const emptySubscribe = () => () => {};

interface WishlistButtonProps {
  productId: string;
  /** "card" = small overlay on product card, "detail" = larger standalone button */
  variant?: "card" | "detail";
  className?: string;
}

export function WishlistButton({
  productId,
  variant = "card",
  className = "",
}: WishlistButtonProps) {
  const toggle = useWishlistStore((s) => s.toggle);
  const has = useWishlistStore((s) => s.has);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [bouncing, setBouncing] = useState(false);

  const isWishlisted = mounted ? has(productId) : false;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggle(productId);
      setBouncing(true);
      setTimeout(() => setBouncing(false), 400);
    },
    [toggle, productId]
  );

  if (variant === "detail") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
          isWishlisted
            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
        } ${className}`}
        aria-label={isWishlisted ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
      >
        <Heart
          className={`size-4 transition-transform ${bouncing ? "scale-125" : "scale-100"} ${
            isWishlisted ? "fill-red-500 text-red-500" : ""
          }`}
        />
        {isWishlisted ? "V oblíbených" : "Oblíbit"}
      </button>
    );
  }

  // Card variant — small overlay button
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all hover:bg-background hover:shadow-md ${className}`}
      aria-label={isWishlisted ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
    >
      <Heart
        className={`size-4 transition-transform duration-300 ${
          bouncing ? "scale-125" : "scale-100"
        } ${isWishlisted ? "fill-red-500 text-red-500" : "text-foreground/70"}`}
      />
    </button>
  );
}
