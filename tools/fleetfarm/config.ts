import type { FleetFarmCategoryConfig } from "./types.js";

/**
 * ASSUMPTION CHANGE: FleetFarm category listing URLs are configured explicitly.
 * robots.txt disallows /browse/ and /search/ — do not use those paths for scraping.
 * Default seeding uses curated fixtures; pass --live only for demo/manual runs on allowed URLs.
 */
export const FLEETFARM_CATEGORIES: FleetFarmCategoryConfig[] = [
  {
    code: "tools-hardware",
    name: "Tools & Hardware",
    listingUrl: "https://www.fleetfarm.com/c/tools-hardware",
    maxProducts: 25,
    categoryPath: ["Fleet Farm Demo", "Tools & Hardware"],
  },
  {
    code: "outdoor-power",
    name: "Outdoor Power Equipment",
    listingUrl: "https://www.fleetfarm.com/c/outdoor-power-equipment",
    maxProducts: 25,
    categoryPath: ["Fleet Farm Demo", "Outdoor Power Equipment"],
  },
  {
    code: "clothing-workwear",
    name: "Clothing & Workwear",
    listingUrl: "https://www.fleetfarm.com/c/clothing-footwear",
    maxProducts: 25,
    categoryPath: ["Fleet Farm Demo", "Clothing & Workwear"],
  },
  {
    code: "fishing-hunting",
    name: "Fishing & Hunting",
    listingUrl: "https://www.fleetfarm.com/c/fishing",
    maxProducts: 25,
    categoryPath: ["Fleet Farm Demo", "Fishing & Hunting"],
  },
];

/** robots.txt disallowed path prefixes for FleetFarm.com */
export const ROBOTS_DISALLOWED_PREFIXES = [
  "/browse/",
  "/search/",
  "/quickview/",
  "/account/",
  "/checkout/",
  "/ajax/",
];

export const SCRAPE_RATE_LIMIT_MS = 2_000;
export const SCRAPE_USER_AGENT =
  "ProductInfoMan-DemoSeeder/1.0 (+internal demo; contact admin@demo.local)";
