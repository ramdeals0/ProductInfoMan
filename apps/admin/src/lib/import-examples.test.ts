import { describe, expect, it } from "vitest";
import {
  IMPORT_EXAMPLE_FILE_TYPES,
  PRODUCT_IMPORT_CORE_FIELD_KEYS,
  PRODUCT_IMPORT_SAMPLE_FIELD_KEYS,
} from "@productinfoman/import-engine/examples";

describe("import-examples", () => {
  it("includes all supported file types", () => {
    expect(IMPORT_EXAMPLE_FILE_TYPES).toEqual(["CSV", "JSON", "XML"]);
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
