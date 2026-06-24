import { describe, expect, it } from "vitest";
import {
  buildErrorReportCsv,
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
});
