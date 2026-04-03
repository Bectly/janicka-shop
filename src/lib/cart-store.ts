import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
  slug: string;
  reservedUntil?: string; // ISO string — when the reservation expires
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, size: string, color: string) => void;
  updateQuantity: (
    productId: string,
    size: string,
    color: string,
    quantity: number
  ) => void;
  updateReservation: (productId: string, reservedUntil: string | null) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId
          );

          // Second-hand: each piece is unique, no stacking
          if (existing) return state;

          return { items: [...state.items, { ...item, quantity: 1 }] };
        }),

      removeItem: (productId, size, color) =>
        set((state) => ({
          items: state.items.filter(
            (i) =>
              !(
                i.productId === productId &&
                i.size === size &&
                i.color === color
              )
          ),
        })),

      updateQuantity: (productId, size, color, quantity) =>
        set((state) => ({
          // Second-hand: qty is always 1; decrement to 0 removes the item
          items:
            quantity <= 0
              ? state.items.filter(
                  (i) =>
                    !(
                      i.productId === productId &&
                      i.size === size &&
                      i.color === color
                    )
                )
              : state.items.map((i) =>
                  i.productId === productId &&
                  i.size === size &&
                  i.color === color
                    ? { ...i, quantity: 1 }
                    : i
                ),
        })),

      updateReservation: (productId, reservedUntil) =>
        set((state) => ({
          items: reservedUntil
            ? state.items.map((i) =>
                i.productId === productId
                  ? { ...i, reservedUntil }
                  : i
              )
            : state.items.filter((i) => i.productId !== productId),
        })),

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "janicka-cart",
    }
  )
);
