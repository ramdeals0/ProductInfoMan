import { describe, expect, it } from "vitest";
import {
  buildDefaultAttributeTemplateMappings,
  buildDefaultCategoryTemplateMappings,
  buildDefaultFacetTemplateMappings,
  buildTaxonomyImportExample,
  normalizeAttributeRow,
  normalizeCategoryRow,
  normalizeFacetRow,
  sortCategoryRowsForCommit,
  validateAttributeImportRows,
  validateCategoryImportRows,
  validateFacetImportRows,
} from "./taxonomy-import-fields.js";

describe("taxonomy-import-fields", () => {
  it("builds default mappings for category, attribute, and facet imports", () => {
    expect(buildDefaultCategoryTemplateMappings().some((mapping) => mapping.sourceColumn === "parent_code")).toBe(
      true,
    );
    expect(
      buildDefaultAttributeTemplateMappings().some(
        (mapping) => mapping.sourceColumn === "attribute_group_code",
      ),
    ).toBe(true);
    expect(
      buildDefaultFacetTemplateMappings().some(
        (mapping) => mapping.sourceColumn === "source_attribute_key",
      ),
    ).toBe(true);
  });

  it("normalizes and validates category rows with parent references in the same file", () => {
    const mappings = buildDefaultCategoryTemplateMappings();
    const rows = [
      {
        code: "child",
        name: "Child",
        slug: "child",
        parent_code: "parent",
        sort_order: "1",
        status: "ACTIVE",
      },
      {
        code: "parent",
        name: "Parent",
        slug: "parent",
        parent_code: "",
        sort_order: "0",
        status: "ACTIVE",
      },
    ].map((raw, index) => normalizeCategoryRow(index + 1, raw, mappings, "IGNORE")!);

    const result = validateCategoryImportRows(rows, {
      duplicatePolicy: "REJECT",
      importType: "CREATE",
      existingCodes: new Set(),
    });

    expect(result.validRows).toHaveLength(2);
    expect(sortCategoryRowsForCommit(result.validRows)[0]?.code).toBe("parent");
  });

  it("validates attribute rows against known or in-file attribute groups", () => {
    const mappings = buildDefaultAttributeTemplateMappings();
    const row = normalizeAttributeRow(
      1,
      {
        attribute_group_code: "specs",
        key: "color",
        label: "Color",
        data_type: "TEXT",
      },
      mappings,
      "IGNORE",
    )!;

    const result = validateAttributeImportRows([row], {
      duplicatePolicy: "REJECT",
      importType: "CREATE",
      existingKeys: new Set(),
      attributeGroupCodes: new Set(),
      attributeGroupCodesInFile: new Set(["specs"]),
    });

    expect(result.validRows).toHaveLength(1);
  });

  it("rejects facet rows when the source attribute is missing", () => {
    const mappings = buildDefaultFacetTemplateMappings();
    const row = normalizeFacetRow(
      1,
      {
        key: "color",
        label: "Color",
        source_attribute_key: "missing",
      },
      mappings,
      "IGNORE",
    )!;

    const result = validateFacetImportRows([row], {
      duplicatePolicy: "REJECT",
      importType: "CREATE",
      existingKeys: new Set(),
      attributeKeys: new Set(["fabric"]),
      categoryCodes: new Set(["shirts"]),
    });

    expect(result.validRows).toHaveLength(0);
    expect(result.errors[0]?.errorCode).toBe("INVALID_REFERENCE");
  });

  it("builds taxonomy example files for each entity type", () => {
    for (const entityType of ["CATEGORY", "ATTRIBUTE", "FACET"] as const) {
      const csv = buildTaxonomyImportExample(entityType, "CSV");
      expect(csv.fileName).toContain("example.csv");
      expect(csv.content.length).toBeGreaterThan(0);
    }
  });
});
