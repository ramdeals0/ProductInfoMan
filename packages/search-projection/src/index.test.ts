import { describe, expect, it } from "vitest";
import {
  aggregateFacets,
  buildSearchDocument,
  isIndexableStatus,
  matchesSearchQuery,
  type BuildSearchDocumentInput,
} from "./index.js";

const baseInput: BuildSearchDocumentInput = {
  organizationId: "org-1",
  productId: "prod-1",
  sku: "SKU-001",
  parentProductId: null,
  productType: "SIMPLE",
  title: "Blue Widget",
  brand: "Acme",
  description: "A useful widget",
  status: "APPROVED",
  publishedAt: null,
  primaryCategory: { id: "cat-shirts", path: "/apparel/mens/shirts" },
  secondaryCategories: [],
  attributes: [
    { key: "color", attributeDefinitionId: "attr-color", value: "Blue" },
    { key: "size", attributeDefinitionId: "attr-size", value: "M" },
  ],
  attributeDefinitions: [
    {
      id: "attr-color",
      key: "color",
      dataType: "ENUM",
      isVariantAxis: true,
      isFilterable: true,
      isSearchable: true,
    },
    {
      id: "attr-size",
      key: "size",
      dataType: "ENUM",
      isVariantAxis: true,
      isFilterable: true,
      isSearchable: false,
    },
  ],
  facetDefinitions: [
    { key: "color", sourceAttributeKey: "color" },
    { key: "size", sourceAttributeKey: "size" },
  ],
};

describe("isIndexableStatus", () => {
  it("allows approved and published statuses only", () => {
    expect(isIndexableStatus("APPROVED")).toBe(true);
    expect(isIndexableStatus("PUBLISH_READY")).toBe(true);
    expect(isIndexableStatus("PUBLISHED")).toBe(true);
    expect(isIndexableStatus("DRAFT")).toBe(false);
    expect(isIndexableStatus("IN_REVIEW")).toBe(false);
    expect(isIndexableStatus("REJECTED")).toBe(false);
  });
});

describe("buildSearchDocument", () => {
  it("returns null for draft products", () => {
    expect(buildSearchDocument({ ...baseInput, status: "DRAFT" })).toBeNull();
  });

  it("projects approved products with facets and grouping fields", () => {
    const doc = buildSearchDocument(baseInput);
    expect(doc).not.toBeNull();
    expect(doc!.product_id).toBe("prod-1");
    expect(doc!.group_key).toBe("prod-1");
    expect(doc!.category_paths).toEqual(["/apparel/mens/shirts"]);
    expect(doc!.facet_fields).toEqual({ color: "Blue", size: "M" });
    expect(doc!.variant_attributes).toEqual({ color: "Blue", size: "M" });
    expect(doc!.channel_availability.b2b).toBe(true);
    expect(doc!.channel_availability.web).toBe(false);
  });

  it("uses parent id as group key for variants", () => {
    const doc = buildSearchDocument({
      ...baseInput,
      productId: "variant-1",
      parentProductId: "parent-1",
      productType: "VARIANT",
    });
    expect(doc!.group_key).toBe("parent-1");
    expect(doc!.parent_product_id).toBe("parent-1");
  });
});

describe("aggregateFacets", () => {
  it("counts facet values across documents", () => {
    const docs = [
      buildSearchDocument(baseInput)!,
      buildSearchDocument({
        ...baseInput,
        productId: "prod-2",
        sku: "SKU-002",
        attributes: [
          { key: "color", attributeDefinitionId: "attr-color", value: "White" },
          { key: "size", attributeDefinitionId: "attr-size", value: "L" },
        ],
      })!,
      buildSearchDocument({
        ...baseInput,
        productId: "prod-3",
        sku: "SKU-003",
        attributes: [
          { key: "color", attributeDefinitionId: "attr-color", value: "Blue" },
          { key: "size", attributeDefinitionId: "attr-size", value: "M" },
        ],
      })!,
    ];

    const facets = aggregateFacets(docs, ["color", "size"]);
    expect(facets.find((f) => f.key === "color")?.buckets).toEqual([
      { value: "Blue", count: 2 },
      { value: "White", count: 1 },
    ]);
    expect(facets.find((f) => f.key === "size")?.buckets).toEqual([
      { value: "L", count: 1 },
      { value: "M", count: 2 },
    ]);
  });
});

describe("matchesSearchQuery", () => {
  it("filters by category and facet values", () => {
    const doc = buildSearchDocument(baseInput)!;
    expect(
      matchesSearchQuery(doc, { categoryId: "cat-shirts", filters: { color: "Blue" } }),
    ).toBe(true);
    expect(matchesSearchQuery(doc, { categoryId: "missing" })).toBe(false);
    expect(matchesSearchQuery(doc, { filters: { color: "Red" } })).toBe(false);
  });
});
