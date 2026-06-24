import { describe, expect, it } from "vitest";
import { applyFacetRuleToValue } from "./index.js";

const PRICE_BUCKETS = [
  { code: "under_25", label: "Under $25", min: null, max: 25 },
  { code: "25_to_50", label: "$25 to $50", min: 25, max: 50 },
];

describe("applyFacetRuleToValue", () => {
  it("passes through DIRECT values", () => {
    expect(applyFacetRuleToValue("DIRECT", null, "Blue")).toBe("Blue");
  });

  it("buckets numeric values with RANGE_BUCKET", () => {
    expect(
      applyFacetRuleToValue("RANGE_BUCKET", { buckets: PRICE_BUCKETS }, 49.99),
    ).toBe("25_to_50");
  });

  it("normalizes strings", () => {
    expect(
      applyFacetRuleToValue("NORMALIZE", { trim: true, case: "title" }, "  acme  "),
    ).toBe("Acme");
  });
});
