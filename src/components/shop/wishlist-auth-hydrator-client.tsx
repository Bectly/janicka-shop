"use client";

import { useEffect, useRef } from "react";
import { useAuthStore, type SessionRole } from "@/lib/auth-store";
import { useWishlistStore } from "@/lib/wishlist-store";

interface Props {
  role: SessionRole;
  wishlistIds: string[];
}

/**
 * Bridges server session into client-side stores.
 * - Sets `useAuthStore.role` so WishlistButton knows whether to call DB or just Zustand.
 * - For customers, mirrors DB wishlist IDs into Zustand once per page load — DB is
 *   the source of truth for signed-in users; Zustand only mirrors for instant UI.
 *
 * Only mirrors on first mount (per nav). Optimistic updates from WishlistButton
 * + revalidateTag-driven re-renders keep the two in sync afterwards.
 */
export function WishlistAuthHydratorClient({ role, wishlistIds }: Props) {
  const setRole = useAuthStore((s) => s.setRole);
  const mirrored = useRef(false);

  useEffect(() => {
    setRole(role);
  }, [role, setRole]);

  useEffect(() => {
    if (mirrored.current) return;
    mirrored.current = true;
    if (role !== "customer") return;
    useWishlistStore.getState().setItems(wishlistIds);
  }, [role, wishlistIds]);

  return null;
}
