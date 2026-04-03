"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";

/**
 * Clears only the ordered products from the cart (by productId).
 * Prevents wiping the entire cart when a user revisits an old order page.
 */
export function ClearCartOnMount({ orderedProductIds }: { orderedProductIds: string[] }) {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);

  useEffect(() => {
    if (orderedProductIds.length === 0) return;
    const ordered = new Set(orderedProductIds);
    for (const item of items) {
      if (ordered.has(item.productId)) {
        removeItem(item.productId, item.size, item.color);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount only

  return null;
}
