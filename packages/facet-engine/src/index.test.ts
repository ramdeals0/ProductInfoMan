import { describe, expect, it } from "vitest";
import { getCategoryPathPrefixes, resolveCategoryFacets, resolveFacetOptions } from "./index.js";

describe("facet-engine", () => {
  it("builds category path prefixes for ancestor lookup", () => {
    expect(getCategoryPathPrefixes("/toys/action-figures")).toEqual([
      "/toys",
      "/toys/action-figures",
    ]);
    expect(getCategoryPathPrefixes("/apparel")).toEqual(["/apparel"]);
  });

  it("resolves controlled facet values before enum fallbacks", () => {
    const options = resolveFacetOptions({
      key: "color",
      label: "Color",
      sourceAttributeKey: "color",
      isDynamic: false,
      sortOrder: 0,
      rules: [{ ruleType: "DIRECT", priority: 0 }],
      facetValues: [
        { value: "blue", label: "Blue", sortOrder: 0, isActive: true },
        { value: "white", label: "White", sortOrder: 1, isActive: true },
      ],
      enumValues: [{ value: "ignored", label: "Ignored", sortOrder: 0 }],
    });

    expect(options).toEqual([
      { value: "blue", label: "Blue", sortOrder: 0 },
      { value: "white", label: "White", sortOrder: 1 },
    ]);
  });

  it("falls back to attribute enum values when no facet values exist", () => {
    const options = resolveFacetOptions({
      key: "size",
      label: "Size",
      sourceAttributeKey: "size",
      isDynamic: false,
      sortOrder: 1,
      rules: [{ ruleType: "DIRECT", priority: 0 }],
      facetValues: [],
      enumValues: [
        { value: "S", label: "Small", sortOrder: 0 },
        { value: "M", label: "Medium", sortOrder: 1 },
      ],
    });

    expect(options).toEqual([
      { value: "S", label: "Small", sortOrder: 0 },
      { value: "M", label: "Medium", sortOrder: 1 },
    ]);
  });

  it("builds category facet metadata in display order", () => {
    const facets = resolveCategoryFacets([
      {
        key: "size",
        label: "Size",
        sourceAttributeKey: "size",
        isDynamic: false,
        sortOrder: 2,
        rules: [{ ruleType: "DIRECT", priority: 0 }],
        facetValues: [],
        enumValues: [{ value: "M", label: "Medium", sortOrder: 0 }],
      },
      {
        key: "color",
        label: "Color",
        sourceAttributeKey: "color",
        isDynamic: false,
        sortOrder: 1,
        rules: [{ ruleType: "DIRECT", priority: 0 }],
        facetValues: [{ value: "blue", label: "Blue", sortOrder: 0, isActive: true }],
        enumValues: [],
      },
    ]);

    expect(facets.map((facet) => facet.key)).toEqual(["color", "size"]);
    expect(facets[0]?.options[0]).toEqual({
      value: "blue",
      label: "Blue",
      sortOrder: 0,
    });
  });
});
