"use client";

import { useEffect, useRef } from "react";
import { useWishlistStore } from "@/lib/wishlist-store";

interface WishlistMergeClientProps {
  /** Authoritative DB wishlist IDs — used to detect anon-only items needing sync. */
  dbIds: string[];
}

/**
 * Self-healing safety net for legacy / cross-tab state where Zustand has anon
 * items the DB hasn't seen yet (login form already runs the canonical merge,
 * and `WishlistAuthHydrator` mirrors DB → Zustand on layout mount). If anon-only
 * items remain in Zustand at this point, push them once to /api/wishlist/sync.
 *
 * Does NOT overwrite Zustand — that's the hydrator's job. Tag invalidation
 * re-fetches the page on the next render so the grid shows merged items.
 */
export function WishlistMergeClient({ dbIds }: WishlistMergeClientProps) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const dbIdSet = new Set(dbIds);
    const localOnly = useWishlistStore
      .getState()
      .items.filter((id) => !dbIdSet.has(id));
    if (localOnly.length === 0) return;

    (async () => {
      try {
        await fetch("/api/wishlist/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: localOnly.slice(0, 200) }),
        });
        // No setItems / router.refresh — WishlistAuthHydrator owns the mirror,
        // and revalidateTag fired by /api/wishlist/sync will refresh next nav.
      } catch {
        // Offline — DB still authoritative on next visit; local store unchanged.
      }
    })();
  }, [dbIds]);

  return null;
}
