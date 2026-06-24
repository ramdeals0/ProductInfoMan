import { describe, expect, it } from "vitest";
import { formatZodError, TaxonomyKeySchema } from "./index.js";

describe("TaxonomyKeySchema", () => {
  it("accepts lowercase snake_case keys", () => {
    expect(TaxonomyKeySchema.parse("price_range")).toBe("price_range");
  });

  it("rejects uppercase and spaces with a helpful message", () => {
    const result = TaxonomyKeySchema.safeParse("Price Range");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain("lowercase letters");
    }
  });
});
