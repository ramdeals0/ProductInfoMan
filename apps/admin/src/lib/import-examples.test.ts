import { describe, expect, it } from "vitest";
import {
  buildImportExampleFile,
  IMPORT_EXAMPLE_FILE_TYPES,
  PRODUCT_IMPORT_CORE_FIELD_KEYS,
  PRODUCT_IMPORT_SAMPLE_FIELD_KEYS,
} from "@productinfoman/import-engine/examples";

describe("import-examples", () => {
  it("includes all supported file types", () => {
    expect(IMPORT_EXAMPLE_FILE_TYPES).toEqual(["CSV", "JSON", "XML"]);
  });

  it("includes parent and variant product types in sample downloads", () => {
    const csv = buildImportExampleFile("CSV").content;
    expect(csv).toContain(",PARENT,");
    expect(csv).toContain(",VARIANT,");
    expect(csv).toContain("CSV-003");
  });

  it("keeps sample field keys aligned with the import engine catalog", () => {
    for (const field of [
      "summary",
      "selling_points",
      "start_date",
      "discontinue_date",
      "color",
      "size",
    ]) {
      expect(PRODUCT_IMPORT_SAMPLE_FIELD_KEYS).toContain(field);
    }

    expect(PRODUCT_IMPORT_CORE_FIELD_KEYS).toEqual(
      expect.arrayContaining([
        "summary",
        "selling_points",
        "start_date",
        "discontinue_date",
      ]),
    );
  });
});
