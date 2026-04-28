"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWishlistStore } from "@/lib/wishlist-store";

interface WishlistMergeClientProps {
  /** Authoritative DB wishlist IDs — used to keep the header/bottom-nav badge in sync. */
  dbIds: string[];
}

/**
 * Merges localStorage wishlist with DB on mount: POSTs local IDs to
 * /api/wishlist/sync, then mirrors the merged DB set back into the local store
 * so the header / bottom-nav counter badges stay accurate without a re-fetch.
 */
export function WishlistMergeClient({ dbIds }: WishlistMergeClientProps) {
  const ran = useRef(false);
  const router = useRouter();
  const localIds = useWishlistStore((s) => s.items);
  const setItems = useWishlistStore((s) => s.setItems);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const localOnly = localIds.filter((id) => !dbIds.includes(id));

    if (localOnly.length === 0) {
      // No merge needed — just mirror DB → local so badges match server state.
      setItems(dbIds);
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/wishlist/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: localOnly.slice(0, 200) }),
        });
        if (res.ok) {
          setItems([...dbIds, ...localOnly]);
          router.refresh();
        }
      } catch {
        // Offline — local store keeps its own state; DB still authoritative on next visit.
      }
    })();
  }, [localIds, dbIds, setItems, router]);

  return null;
}
