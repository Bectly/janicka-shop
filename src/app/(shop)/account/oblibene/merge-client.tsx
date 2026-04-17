"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWishlistStore } from "@/lib/wishlist-store";

/**
 * Merges localStorage wishlist with DB on mount: POSTs local IDs to
 * /api/wishlist/sync, clears the local store, and refreshes the page so the
 * server component re-renders with the merged DB wishlist.
 */
export function WishlistMergeClient() {
  const ran = useRef(false);
  const router = useRouter();
  const ids = useWishlistStore((s) => s.items);
  const clear = useWishlistStore((s) => s.clear);

  useEffect(() => {
    if (ran.current) return;
    if (ids.length === 0) {
      ran.current = true;
      return;
    }
    ran.current = true;

    const payload = ids.slice(0, 200);
    (async () => {
      try {
        const res = await fetch("/api/wishlist/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: payload }),
        });
        if (res.ok) {
          clear();
          router.refresh();
        }
      } catch {
        // Offline or network error — silent; user still sees DB wishlist.
      }
    })();
  }, [ids, clear, router]);

  return null;
}
