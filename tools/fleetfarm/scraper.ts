import { createHash } from "node:crypto";
import {
  FLEETFARM_CATEGORIES,
  SCRAPE_RATE_LIMIT_MS,
  SCRAPE_USER_AGENT,
} from "./config.js";
import type { FleetFarmCategoryConfig } from "./types.js";
import { getFixtureCatalog } from "./fixtures.js";
import { simulatedRating } from "./facets.js";
import { isUrlAllowedByRobots, parseProductDetailHtml, parseProductListHtml } from "./parsers.js";
import { RateLimiter } from "./rate-limiter.js";
import type { ScrapedProduct } from "./types.js";

function externalIdFor(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 16);
}

async function fetchHtml(url: string, limiter: RateLimiter): Promise<string> {
  if (!isUrlAllowedByRobots(url)) {
    throw new Error(`URL blocked by robots.txt policy: ${url}`);
  }

  await limiter.wait();
  const response = await fetch(url, {
    headers: {
      "User-Agent": SCRAPE_USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

async function scrapeCategory(
  category: FleetFarmCategoryConfig,
  limiter: RateLimiter,
): Promise<ScrapedProduct[]> {
  if (!isUrlAllowedByRobots(category.listingUrl)) {
    throw new Error(`Category URL blocked by robots.txt: ${category.listingUrl}`);
  }

  const html = await fetchHtml(category.listingUrl, limiter);
  const listItems = parseProductListHtml(html, category.listingUrl).slice(0, category.maxProducts);
  const products: ScrapedProduct[] = [];

  for (const item of listItems) {
    if (!isUrlAllowedByRobots(item.productUrl)) continue;

    const externalId = externalIdFor(item.productUrl);
    let detail: ScrapedProduct | null = null;

    try {
      const detailHtml = await fetchHtml(item.productUrl, limiter);
      detail = parseProductDetailHtml(detailHtml, {
        externalId,
        productUrl: item.productUrl,
        categoryPath: category.categoryPath,
        categoryCode: category.code,
      });
    } catch {
      // fall back to list item data
    }

    const price = detail?.price ?? item.price ?? null;
    const brand = detail?.brand ?? item.brand;
    const attributes: Record<string, string | number | boolean> = {
      ...(detail?.attributes ?? {}),
    };
    if (brand) attributes.brand = brand;
    if (price != null) {
      attributes.price = price;
    }
    attributes.rating = simulatedRating(externalId);
    attributes.availability = "In Stock";

    products.push({
      externalId,
      title: detail?.title ?? item.title,
      price,
      brand,
      description: detail?.description,
      productUrl: item.productUrl,
      categoryPath: category.categoryPath,
      categoryCode: category.code,
      attributes,
    });
  }

  return products;
}

export type ScrapeOptions = {
  live?: boolean;
  categories?: FleetFarmCategoryConfig[];
};

/**
 * Load FleetFarm-inspired products.
 * Default: curated fixtures (no HTTP).
 * --live: attempt polite scraping of configured URLs with rate limiting.
 */
export async function loadFleetFarmProducts(options: ScrapeOptions = {}): Promise<ScrapedProduct[]> {
  const categories = options.categories ?? FLEETFARM_CATEGORIES;

  if (!options.live) {
    return getFixtureCatalog(categories);
  }

  const limiter = new RateLimiter(SCRAPE_RATE_LIMIT_MS);
  const products: ScrapedProduct[] = [];

  for (const category of categories) {
    try {
      const scraped = await scrapeCategory(category, limiter);
      if (scraped.length > 0) {
        products.push(...scraped);
        console.log(`Scraped ${scraped.length} products from ${category.code}`);
        continue;
      }
    } catch (error) {
      console.warn(`Live scrape failed for ${category.code}:`, (error as Error).message);
    }

    const fixtures = getFixtureCatalog([category]);
    products.push(...fixtures);
    console.log(`Using fixtures for ${category.code} (${fixtures.length} products)`);
  }

  return products;
}
