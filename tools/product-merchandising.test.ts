import { describe, expect, it } from "vitest";
import { buildProductMerchandisingCopy } from "./lib/product-merchandising-copy.js";

describe("product merchandising copy", () => {
  it("generates a short summary and ten selling points", () => {
    const copy = buildProductMerchandisingCopy("Acme Drill Kit", "Tools & Hardware", 3);
    const words = copy.summary.trim().split(/\s+/).filter(Boolean);
    expect(words.length).toBeGreaterThanOrEqual(15);
    expect(words.length).toBeLessThanOrEqual(24);
    expect(copy.sellingPoints).toHaveLength(10);
    expect(copy.description).toContain("Highlights:");
  });
});
