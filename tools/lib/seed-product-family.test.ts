import { describe, expect, it } from "vitest";
import { DEMO_PARENT_VARIANT_FAMILIES } from "./seed-product-family.js";

describe("seed-product-family", () => {
  it("defines multiple parent families with variant children", () => {
    expect(DEMO_PARENT_VARIANT_FAMILIES.length).toBeGreaterThanOrEqual(4);

    for (const family of DEMO_PARENT_VARIANT_FAMILIES) {
      expect(family.parentSku).toMatch(/^[A-Z]+-\d+$/);
      expect(family.variants.length).toBeGreaterThanOrEqual(3);
      for (const variant of family.variants) {
        expect(variant.sku.startsWith(family.parentSku)).toBe(true);
      }
    }
  });

  it("uses unique parent and variant SKUs across all families", () => {
    const skus = new Set<string>();
    for (const family of DEMO_PARENT_VARIANT_FAMILIES) {
      expect(skus.has(family.parentSku)).toBe(false);
      skus.add(family.parentSku);
      for (const variant of family.variants) {
        expect(skus.has(variant.sku)).toBe(false);
        skus.add(variant.sku);
      }
    }
  });
});
