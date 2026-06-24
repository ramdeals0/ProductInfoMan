import { describe, expect, it } from "vitest";
import { IMPORT_EXAMPLE_TYPES } from "./import-examples";

describe("import-examples", () => {
  it("includes all supported file types", () => {
    expect(IMPORT_EXAMPLE_TYPES).toEqual(["CSV", "JSON", "XML"]);
  });
});
