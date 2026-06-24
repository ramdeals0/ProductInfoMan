import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "@productinfoman/validation";

describe("parseSearchQuery", () => {
  it("parses bracket-style facet filters from flat query params", () => {
    const query = parseSearchQuery({
      page: "1",
      pageSize: "12",
      storefront: "true",
      "filters[brand]": "Acme",
      "filters[color]": "Blue",
    });

    expect(query.filters).toEqual({
      brand: "Acme",
      color: "Blue",
    });
    expect(query.page).toBe(1);
    expect(query.storefront).toBe(true);
  });

  it("collects repeated bracket filter values", () => {
    const query = parseSearchQuery({
      "filters[color]": ["Red", "Blue"],
    });

    expect(query.filters).toEqual({ color: ["Red", "Blue"] });
  });

  it("prefers nested filters when provided", () => {
    const query = parseSearchQuery({
      filters: { brand: "Northline" },
      "filters[color]": "Blue",
    });

    expect(query.filters).toEqual({ brand: "Northline" });
  });
});
