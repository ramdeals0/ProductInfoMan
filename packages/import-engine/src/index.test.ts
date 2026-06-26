import { describe, expect, it } from "vitest";
import {
  buildErrorReportCsv,
  applyFacetValuesToAttributes,
  normalizeRow,
  parseCsv,
  validateImportRows,
} from "./index.js";

const mappings = [
  { sourceColumn: "sku", targetField: "sku", isRequired: true },
  { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
  { sourceColumn: "title", targetField: "title" },
  { sourceColumn: "parent_sku", targetField: "parent_sku" },
  { sourceColumn: "category_code", targetField: "category_code" },
];

describe("import-engine", () => {
  it("parses CSV rows with headers", () => {
    const parsed = parseCsv("sku,product_type,title\nA-1,SIMPLE,Shirt");
    expect(parsed.headers).toEqual(["sku", "product_type", "title"]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.data).toEqual({
      sku: "A-1",
      product_type: "SIMPLE",
      title: "Shirt",
    });
  });

  it("rejects duplicate SKUs and missing required fields", () => {
    const parsed = parseCsv(
      "sku,product_type,title,parent_sku\nP-1,PARENT,Parent\nV-1,VARIANT,,P-1\nP-1,SIMPLE,Duplicate\nS-1,SIMPLE,,",
    );
    const rows = parsed.rows
      .map((row) => normalizeRow(row.rowNumber, row.data, mappings, "IGNORE"))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const result = validateImportRows(rows, {
      duplicatePolicy: "REJECT",
      importType: "CREATE",
      existingSkus: new Set(),
      parentSkusInDb: new Set(),
      categoryCodes: new Set(),
      attributeKeys: new Set(),
      requiredFieldsByType: {
        SIMPLE: ["sku", "product_type", "title"],
        PARENT: ["sku", "product_type", "title"],
        VARIANT: ["sku", "product_type", "parent_sku"],
      },
    });

    expect(result.validRows).toHaveLength(2);
    expect(result.errors.some((error) => error.errorCode === "REQUIRED_FIELD")).toBe(true);
    expect(result.errors.some((error) => error.errorCode === "DUPLICATE_KEY")).toBe(true);
  });

  it("rejects invalid parent references", () => {
    const row = normalizeRow(
      2,
      { sku: "V-1", product_type: "VARIANT", parent_sku: "MISSING" },
      mappings,
      "IGNORE",
    );
    expect(row).not.toBeNull();

    const result = validateImportRows([row!], {
      duplicatePolicy: "REJECT",
      importType: "CREATE",
      existingSkus: new Set(),
      parentSkusInDb: new Set(),
      categoryCodes: new Set(),
      attributeKeys: new Set(),
      requiredFieldsByType: {
        VARIANT: ["sku", "product_type", "parent_sku"],
      },
    });

    expect(result.validRows).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({
      errorCode: "INVALID_PARENT_REFERENCE",
      fieldName: "parent_sku",
    });
  });

  it("rejects unknown category codes and attribute keys", () => {
    const row = normalizeRow(
      2,
      {
        sku: "S-1",
        product_type: "SIMPLE",
        title: "Shirt",
        category_code: "missing-category",
        mystery_attr: "value",
      },
      [...mappings, { sourceColumn: "mystery_attr", targetField: "mystery_attr" }],
      "IGNORE",
    );
    expect(row).not.toBeNull();

    const result = validateImportRows([row!], {
      duplicatePolicy: "REJECT",
      importType: "CREATE",
      existingSkus: new Set(),
      parentSkusInDb: new Set(),
      categoryCodes: new Set(["shirts"]),
      attributeKeys: new Set(["color", "size"]),
      requiredFieldsByType: {
        SIMPLE: ["sku", "product_type", "title"],
      },
    });

    expect(result.validRows).toHaveLength(0);
    expect(result.errors.some((error) => error.errorCode === "INVALID_CATEGORY")).toBe(true);
    expect(result.errors.some((error) => error.errorCode === "UNKNOWN_ATTRIBUTE")).toBe(true);
  });

  it("builds downloadable CSV error reports", () => {
    const csv = buildErrorReportCsv([
      {
        rowNumber: 3,
        fieldName: "sku",
        errorCode: "DUPLICATE_KEY",
        errorMessage: "Duplicate SKU",
        rawValue: "P-1",
      },
    ]);
    expect(csv).toContain("row_number,field_name,error_code,error_message,raw_value");
    expect(csv).toContain("3,sku,DUPLICATE_KEY,Duplicate SKU,P-1");
  });

  it("normalizes dotted JSON/XML field paths via templates", () => {
    const row = normalizeRow(
      1,
      {
        sku: "J-1",
        product_type: "SIMPLE",
        title: "Nested",
        "attributes.color": "Red",
      },
      [
        { sourceColumn: "sku", targetField: "sku", isRequired: true },
        { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
        { sourceColumn: "title", targetField: "title" },
        { sourceColumn: "attributes.color", targetField: "color" },
      ],
      "IGNORE",
    );

    expect(row).toMatchObject({
      sku: "J-1",
      productType: "SIMPLE",
      attributes: { color: "Red" },
    });
  });

  it("reads merchandising fields from raw XML/JSON paths when template mappings are missing", () => {
    const row = normalizeRow(
      1,
      {
        sku: "XML-0011",
        product_type: "SIMPLE",
        title: "Imported Shirt",
        summary: "Short summary.",
        selling_points: "One|Two",
        start_date: "2025-01-01",
        discontinue_date: "2027-12-31",
      },
      mappings,
      "IGNORE",
    );

    expect(row).toMatchObject({
      sku: "XML-0011",
      summary: "Short summary.",
      sellingPoints: ["One", "Two"],
      startDate: "2025-01-01",
      discontinueDate: "2027-12-31",
    });
  });

  it("maps merchandising fields outside of custom attributes", () => {
    const row = normalizeRow(
      1,
      {
        sku: "M-1",
        product_type: "SIMPLE",
        title: "Merch",
        summary: "Short summary.",
        selling_points: "One|Two",
        start_date: "2025-01-01",
        discontinue_date: "2027-12-31",
        color: "Blue",
      },
      [
        { sourceColumn: "sku", targetField: "sku", isRequired: true },
        { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
        { sourceColumn: "title", targetField: "title" },
        { sourceColumn: "summary", targetField: "summary" },
        { sourceColumn: "selling_points", targetField: "selling_points" },
        { sourceColumn: "start_date", targetField: "start_date" },
        { sourceColumn: "discontinue_date", targetField: "discontinue_date" },
        { sourceColumn: "color", targetField: "color" },
      ],
      "IGNORE",
    );

    expect(row).toMatchObject({
      summary: "Short summary.",
      sellingPoints: ["One", "Two"],
      startDate: "2025-01-01",
      discontinueDate: "2027-12-31",
      attributes: { color: "Blue" },
    });
  });

  it("maps facet column values onto facet source attributes", () => {
    const row = normalizeRow(
      1,
      {
        sku: "A-1",
        product_type: "SIMPLE",
        facet_color: "Blue",
        color: "",
      },
      [
        { sourceColumn: "sku", targetField: "sku", isRequired: true },
        { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
        { sourceColumn: "facet_color", targetField: "facet_color" },
        { sourceColumn: "color", targetField: "color" },
      ],
      "IGNORE",
    );

    expect(row).not.toBeNull();
    const enriched = applyFacetValuesToAttributes(
      row!,
      new Map([["color", "color"]]),
    );
    expect(enriched.attributes).toEqual({ color: "Blue" });
  });
});
