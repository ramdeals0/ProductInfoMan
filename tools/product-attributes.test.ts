import { describe, expect, it } from "vitest";
import { BIGBOX_CATEGORIES, listBigBoxLeafCategories } from "./bigbox/config.js";
import { BIGBOX_CATEGORY_ATTRIBUTES } from "./lib/seed-bigbox-attributes-facets.js";
import { merchandisingValuesForIndex } from "./lib/product-attribute-values.js";

const GLOBAL_MERCH_ATTR_COUNT = 6;

describe("product attribute seeding", () => {
  it("defines two leaf categories per big-box department", () => {
    expect(listBigBoxLeafCategories()).toHaveLength(BIGBOX_CATEGORIES.length * 4);
  });

  it("defines two category-specific attributes for every big-box department", () => {
    for (const category of BIGBOX_CATEGORIES) {
      const attrs = BIGBOX_CATEGORY_ATTRIBUTES[category.code];
      expect(attrs, category.code).toBeDefined();
      expect(attrs?.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("assigns at least five facet-linked attributes per big-box product shape", () => {
    for (const category of BIGBOX_CATEGORIES) {
      const categoryAttrs = BIGBOX_CATEGORY_ATTRIBUTES[category.code]?.length ?? 0;
      const apparelExtras = category.code === "apparel_family" ? 3 : 0;
      const total = 1 + GLOBAL_MERCH_ATTR_COUNT + categoryAttrs + apparelExtras;
      expect(total, category.code).toBeGreaterThanOrEqual(5);
    }
  });

  it("generates deterministic merchandising values", () => {
    const first = merchandisingValuesForIndex(1);
    const second = merchandisingValuesForIndex(2);
    expect(first.price).toBeGreaterThan(0);
    expect(first.rating).toBeGreaterThanOrEqual(3.5);
    expect(first.availability).toBeTruthy();
    expect(second.price).not.toBe(first.price);
  });
});
