import { describe, expect, it } from "vitest";
import { CategorySlugSchema, formatZodError, TaxonomyKeySchema } from "./index.js";

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

describe("CategorySlugSchema", () => {
  it("accepts lowercase kebab-case slugs", () => {
    expect(CategorySlugSchema.parse("mens-shirts")).toBe("mens-shirts");
  });

  it("rejects invalid slugs with a helpful message", () => {
    const result = CategorySlugSchema.safeParse("Mens Shirts");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatZodError(result.error)).toContain("hyphens");
    }
  });
});
