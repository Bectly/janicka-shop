"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useSyncExternalStore, useRef, useState, useEffect } from "react";

const emptySubscribe = () => () => {};

export function CartButton() {
  const totalItems = useCartStore((s) => s.totalItems);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const count = mounted ? totalItems() : 0;

  const hasHydrated = useRef(false);
  const prevCount = useRef(0);
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      prevCount.current = count;
      return;
    }
    if (count > prevCount.current) {
      setBouncing(true);
      const timer = setTimeout(() => setBouncing(false), 500);
      prevCount.current = count;
      return () => clearTimeout(timer);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <Link
      href="/cart"
      data-cart-button
      className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground haptic-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={`Košík${count > 0 ? ` (${count})` : ""}`}
    >
      <ShoppingBag className={`size-5 ${bouncing ? "animate-cart-bounce" : ""}`} />
      {count > 0 && (
        <span className={`absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground ${bouncing ? "animate-cart-bounce" : ""}`}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
