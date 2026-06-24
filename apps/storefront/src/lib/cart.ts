"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

type CartState = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  subtotal: () => number;
  itemCount: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((entry) => entry.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((entry) =>
                entry.productId === item.productId
                  ? { ...entry, quantity: entry.quantity + quantity }
                  : entry,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        });
      },
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((entry) =>
            entry.productId === productId ? { ...entry, quantity } : entry,
          ),
        }));
      },
      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((entry) => entry.productId !== productId),
        }));
      },
      clear: () => set({ items: [] }),
      subtotal: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "pim-storefront-cart" },
  ),
);
