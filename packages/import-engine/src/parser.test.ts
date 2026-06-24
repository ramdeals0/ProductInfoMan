import { describe, expect, it } from "vitest";
import {
  collectImportRows,
  fieldsToStringRecord,
  flattenObject,
  ImportParseError,
  inferImportFileType,
  parseJson,
  parseXml,
} from "./parser.js";

describe("import parser", () => {
  it("infers file type from extension and explicit override", () => {
    expect(inferImportFileType("products.csv")).toBe("CSV");
    expect(inferImportFileType("products.json")).toBe("JSON");
    expect(inferImportFileType("products.xml", "xml")).toBe("XML");
    expect(() => inferImportFileType("products.csv", "yaml")).toThrow(ImportParseError);
  });

  it("flattens nested objects with dot notation", () => {
    expect(
      flattenObject({
        sku: "A-1",
        attributes: { color: "Red", size: "M" },
      }),
    ).toEqual({
      sku: "A-1",
      "attributes.color": "Red",
      "attributes.size": "M",
    });
  });

  it("parses JSON arrays into import rows", async () => {
    const rows = await collectImportRows(
      parseJson(
        JSON.stringify([
          {
            sku: "J-1",
            product_type: "SIMPLE",
            title: "JSON Drill",
            attributes: { color: "Red" },
          },
        ]),
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rawRowIndex).toBe(1);
    expect(fieldsToStringRecord(rows[0]!.fields)).toMatchObject({
      sku: "J-1",
      product_type: "SIMPLE",
      title: "JSON Drill",
      "attributes.color": "Red",
    });
  });

  it("rejects malformed JSON", async () => {
    await expect(collectImportRows(parseJson("{not-json"))).rejects.toThrow(/Malformed JSON/);
  });

  it("parses XML product nodes into import rows", async () => {
    const xml = `<?xml version="1.0"?>
<products>
  <product>
    <sku>X-1</sku>
    <product_type>SIMPLE</product_type>
    <title>XML Drill</title>
    <attributes>
      <color>Blue</color>
    </attributes>
  </product>
  <product>
    <sku>X-2</sku>
    <product_type>SIMPLE</product_type>
    <title>XML Saw</title>
  </product>
</products>`;

    const rows = await collectImportRows(parseXml(xml));
    expect(rows).toHaveLength(2);
    expect(fieldsToStringRecord(rows[0]!.fields)).toMatchObject({
      sku: "X-1",
      product_type: "SIMPLE",
      title: "XML Drill",
      "attributes.color": "Blue",
    });
  });

  it("rejects malformed XML", async () => {
    await expect(collectImportRows(parseXml("<<<not-xml>>>"))).rejects.toThrow(ImportParseError);
  });
});
