import { describe, expect, it } from "vitest";
import { FLEETFARM_CATEGORIES, ROBOTS_DISALLOWED_PREFIXES } from "./config.js";
import { getFixtureCatalog } from "./fixtures.js";
import { priceToBucketLabel, simulatedRating } from "./facets.js";
import { isUrlAllowedByRobots, parsePrice, parseProductListHtml } from "./parsers.js";

describe("fleetfarm fixtures", () => {
  it("generates 80 products across 4 categories", () => {
    const products = getFixtureCatalog();
    expect(products.length).toBe(80);
    const codes = new Set(products.map((product) => product.categoryCode));
    expect(codes).toEqual(new Set(["tools", "outdoor_power", "clothing", "fishing"]));
  });

  it("includes amazon-style global attributes", () => {
    const product = getFixtureCatalog()[0]!;
    expect(product.attributes.brand).toBeTruthy();
    expect(product.attributes.price).toBeGreaterThan(0);
    expect(product.attributes.rating).toBeGreaterThanOrEqual(3.5);
    expect(product.attributes.availability).toBe("In Stock");
    expect(product.attributes.price_range).toBeUndefined();
  });
});

describe("fleetfarm parsers", () => {
  it("respects robots.txt disallowed paths", () => {
    expect(isUrlAllowedByRobots("https://www.fleetfarm.com/browse/tools")).toBe(false);
    expect(isUrlAllowedByRobots("https://www.fleetfarm.com/search?q=drill")).toBe(false);
    expect(isUrlAllowedByRobots("https://www.fleetfarm.com/c/tools-hardware")).toBe(true);
  });

  it("parses json-ld product list", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"Test Drill","url":"https://www.fleetfarm.com/p/test","brand":{"name":"DEWALT"},"offers":{"price":"99.99"}}</script>`;
    const items = parseProductListHtml(html, "https://www.fleetfarm.com");
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Test Drill");
    expect(items[0]?.brand).toBe("DEWALT");
    expect(parsePrice("$129.99")).toBe(129.99);
  });

  it("buckets price ranges", () => {
    expect(priceToBucketLabel(10)).toBe("Under $25");
    expect(priceToBucketLabel(129)).toBe("$100 to $200");
    expect(simulatedRating("abc")).toBeGreaterThanOrEqual(3.5);
  });
});

describe("fleetfarm config", () => {
  it("defines 4 demo categories", () => {
    expect(FLEETFARM_CATEGORIES).toHaveLength(4);
    expect(ROBOTS_DISALLOWED_PREFIXES).toContain("/browse/");
  });
});
