import { describe, expect, it } from "vitest";
import { categorySelectOptions, parseFacetFilters } from "./search-params";
import type { CategoryTreeNode } from "@productinfoman/domain";

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

  it("builds indented category select options from the tree", () => {
    const tree: CategoryTreeNode[] = [
      {
        id: "1",
        code: "apparel",
        name: "Apparel",
        slug: "apparel",
        path: "Apparel",
        children: [
          {
            id: "2",
            code: "shirts",
            name: "Shirts",
            slug: "shirts",
            path: "Apparel / Shirts",
            children: [],
          },
        ],
      } as CategoryTreeNode,
    ];

    expect(categorySelectOptions(tree)).toEqual([
      { code: "apparel", label: "Apparel" },
      { code: "shirts", label: "— Shirts" },
    ]);
  });
});
