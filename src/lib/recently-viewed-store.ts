import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_ITEMS = 12;

interface RecentlyViewedItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAt: number | null;
  images: string;
  categoryName: string;
  brand: string | null;
  condition: string;
  viewedAt: number;
}

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  add: (item: Omit<RecentlyViewedItem, "viewedAt">) => void;
  getRecent: (excludeId?: string) => RecentlyViewedItem[];
}

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item) =>
        set((state) => {
          const filtered = state.items.filter((i) => i.id !== item.id);
          return {
            items: [{ ...item, viewedAt: Date.now() }, ...filtered].slice(
              0,
              MAX_ITEMS,
            ),
          };
        }),

      getRecent: (excludeId) => {
        const items = get().items;
        if (!excludeId) return items;
        return items.filter((i) => i.id !== excludeId);
      },
    }),
    {
      name: "janicka-recently-viewed",
    },
  ),
);
