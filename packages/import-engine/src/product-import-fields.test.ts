import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildImportExampleCsv,
  buildImportExampleFile,
  buildImportExampleJson,
  buildImportExampleXml,
  parseImportDate,
  parseImportSellingPoints,
  PRODUCT_IMPORT_CORE_FIELD_KEYS,
  PRODUCT_IMPORT_SAMPLE_FIELD_KEYS,
} from "./product-import-fields.js";

describe("product-import-fields", () => {
  it("includes merchandising fields in the core field catalog", () => {
    expect(PRODUCT_IMPORT_CORE_FIELD_KEYS).toEqual(
      expect.arrayContaining(["summary", "selling_points", "start_date", "discontinue_date"]),
    );
  });

  it("builds CSV examples with every sample field in the header", () => {
    const csv = buildImportExampleCsv();
    const header = csv.split("\n")[0] ?? "";
    for (const field of PRODUCT_IMPORT_SAMPLE_FIELD_KEYS) {
      expect(header).toContain(field);
    }
  });

  it("parses selling points from pipe-delimited and JSON values", () => {
    expect(parseImportSellingPoints("One|Two|Three")).toEqual(["One", "Two", "Three"]);
    expect(parseImportSellingPoints('["Alpha","Beta"]')).toEqual(["Alpha", "Beta"]);
  });

  it("parses import dates as UTC midnight", () => {
    expect(parseImportDate("2025-01-01")?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("includes parent and variant rows in generated examples", () => {
    const products = buildImportExampleJson("JSON");
    expect(products).toContain('"product_type": "PARENT"');
    expect(products).toContain('"product_type": "VARIANT"');
    expect(products).toContain('"parent_sku": "JSON-003"');
  });

  it("includes extended attributes and facet reference columns in CSV samples", () => {
    const csv = buildImportExampleCsv();
    const header = csv.split("\n")[0] ?? "";
    for (const field of ["fabric", "fit", "price", "material", "facet_color", "facet_price"]) {
      expect(header).toContain(field);
    }
    expect(csv).toContain("Cotton");
    expect(csv).toContain("25_to_50");
  });

  it("includes attributes and facets objects in JSON samples", () => {
    const json = buildImportExampleJson("JSON");
    expect(json).toContain('"fabric": "Cotton"');
    expect(json).toContain('"facets": {');
    expect(json).toContain('"price": "25_to_50"');
  });

  it("builds XML examples with parent, variant, nested attributes, and facets", async () => {
    const xml = buildImportExampleXml("XML");
    expect(xml).toContain("<product_type>PARENT</product_type>");
    expect(xml).toContain("<product_type>VARIANT</product_type>");
    expect(xml).toContain("<parent_sku>XML-003</parent_sku>");
    expect(xml).toMatch(/<attributes>\n {6}<color>Blue<\/color>/);
    expect(xml).toContain("<facets>");
    expect(xml).toContain("<fabric>Cotton</fabric>");

    const { collectImportRows, fieldsToStringRecord, parseXml } = await import("./parser.js");
    const rows = await collectImportRows(parseXml(xml));
    expect(rows).toHaveLength(5);
    expect(fieldsToStringRecord(rows[3]!.fields)).toMatchObject({
      sku: "XML-004",
      product_type: "VARIANT",
      parent_sku: "XML-003",
      "attributes.color": "Blue",
      "attributes.size": "M",
      "attributes.fabric": "Cotton",
      "facets.price": "25_to_50",
    });
  });

  it("keeps fixture files aligned with generated examples", () => {
    expect(buildImportExampleFile("CSV").content).toBe(buildImportExampleCsv("CSV"));
    expect(buildImportExampleFile("JSON").content).toBe(buildImportExampleJson("JSON"));
    expect(buildImportExampleFile("XML").content).toBe(buildImportExampleXml("XML"));

    const fixturesDir = path.resolve(fileURLToPath(new URL("../fixtures", import.meta.url)));
    expect(readFileSync(path.join(fixturesDir, "products.csv"), "utf8")).toBe(
      buildImportExampleCsv("CSV"),
    );
    expect(readFileSync(path.join(fixturesDir, "products.json"), "utf8")).toBe(
      buildImportExampleJson("JSON"),
    );
    expect(readFileSync(path.join(fixturesDir, "products.xml"), "utf8")).toBe(
      buildImportExampleXml("XML"),
    );
  });
});
