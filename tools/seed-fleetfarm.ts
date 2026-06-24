import { loadFleetFarmProducts, type ScrapeOptions } from "./fleetfarm/scraper.js";
import type { ScrapedProduct } from "./fleetfarm/types.js";

export type SeedFleetFarmOptions = ScrapeOptions;

export async function seedFleetFarmProducts(options: SeedFleetFarmOptions = {}): Promise<ScrapedProduct[]> {
  return loadFleetFarmProducts(options);
}
