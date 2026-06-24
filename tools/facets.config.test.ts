import { describe, expect, it } from "vitest";
import {
  attributeSeeds,
  facetDefinitionSeeds,
  facetRuleSeeds,
  PRICE_FACET_BUCKETS,
  priceToBucketCode,
  priceToBucketLabel,
} from "./fleetfarm/facets.js";

describe("facets.config", () => {
  it("defines global and category-scoped attributes", () => {
    const codes = attributeSeeds.map((seed) => seed.code);
    expect(codes).toContain("brand");
    expect(codes).toContain("tool_type");
    expect(codes).toContain("apparel_gender");
    expect(codes).toContain("category_subtype");
  });

  it("defines global and category facets", () => {
    const globalFacets = facetDefinitionSeeds.filter((facet) => facet.scope === "global");
    expect(globalFacets.map((facet) => facet.code)).toEqual(["brand", "price", "rating", "availability"]);

    const toolsFacets = facetDefinitionSeeds.filter(
      (facet) => facet.scope === "category" && facet.categoryCode === "tools",
    );
    expect(toolsFacets.map((facet) => facet.code)).toEqual(["tool_type", "power_source", "voltage"]);
  });

  it("configures price range buckets", () => {
    expect(PRICE_FACET_BUCKETS).toHaveLength(5);
    const priceRule = facetRuleSeeds.find((rule) => rule.facetCode === "price");
    expect(priceRule?.ruleType).toBe("range");
    expect(priceRule?.ruleConfig.buckets).toEqual(PRICE_FACET_BUCKETS);
  });

  it("maps numeric price to bucket code and label", () => {
    expect(priceToBucketCode(10)).toBe("under_25");
    expect(priceToBucketCode(25)).toBe("25_to_50");
    expect(priceToBucketCode(199)).toBe("100_to_200");
    expect(priceToBucketCode(250)).toBe("200_plus");
    expect(priceToBucketLabel(49.99)).toBe("$25 to $50");
  });
});
