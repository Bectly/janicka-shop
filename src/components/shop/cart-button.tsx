"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export function CartButton() {
  const totalItems = useCartStore((s) => s.totalItems);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const count = mounted ? totalItems() : 0;

  return (
    <Link
      href="/cart"
      className="relative inline-flex items-center justify-center rounded-lg p-2 text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
      aria-label={`Košík${count > 0 ? ` (${count})` : ""}`}
    >
      <ShoppingBag className="size-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
