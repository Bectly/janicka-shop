import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  items: string[]; // product IDs only — fresh data fetched on wishlist page
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  count: () => number;
  clear: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],

      toggle: (productId) =>
        set((state) => {
          const exists = state.items.includes(productId);
          return {
            items: exists
              ? state.items.filter((id) => id !== productId)
              : [...state.items, productId],
          };
        }),

      has: (productId) => get().items.includes(productId),

      count: () => get().items.length,

      clear: () => set({ items: [] }),
    }),
    {
      name: "janicka-wishlist",
    }
  )
);
