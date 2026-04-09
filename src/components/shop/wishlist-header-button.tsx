"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function WishlistHeaderButton() {
  const count = useWishlistStore((s) => s.count);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const n = mounted ? count() : 0;

  return (
    <Link
      href="/oblibene"
      className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground haptic-press"
      aria-label={`Oblíbené${n > 0 ? ` (${n})` : ""}`}
    >
      <Heart className="size-5" />
      {n > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
