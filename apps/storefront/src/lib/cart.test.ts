import { describe, expect, it, beforeEach } from "vitest";
import { useCartStore } from "./cart";

describe("cart store", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it("adds items and computes subtotal", () => {
    const store = useCartStore.getState();
    store.addItem({ productId: "p1", sku: "SKU-1", name: "Shirt", price: 25 });
    store.addItem({ productId: "p2", sku: "SKU-2", name: "Hat", price: 15 }, 2);

    expect(useCartStore.getState().itemCount()).toBe(3);
    expect(useCartStore.getState().subtotal()).toBe(55);
  });

  it("merges duplicate product lines", () => {
    const store = useCartStore.getState();
    store.addItem({ productId: "p1", sku: "SKU-1", name: "Shirt", price: 25 });
    store.addItem({ productId: "p1", sku: "SKU-1", name: "Shirt", price: 25 });

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]?.quantity).toBe(2);
  });
});
