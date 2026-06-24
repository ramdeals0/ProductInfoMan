import { describe, expect, it } from "vitest";
import { parseFacetFilters } from "./search-params";

describe("search-params", () => {
  it("parses facet query params", () => {
    const params = new URLSearchParams("facet[color]=Red&facet[size]=10&page=2");
    expect(parseFacetFilters(params)).toEqual({
      color: "Red",
      size: "10",
    });
  });

  it("collects multiple values for the same facet", () => {
    const params = new URLSearchParams();
    params.append("facet[color]", "Red");
    params.append("facet[color]", "Blue");
    expect(parseFacetFilters(params)).toEqual({ color: ["Red", "Blue"] });
  });
});
