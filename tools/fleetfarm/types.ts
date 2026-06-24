export type ScrapedProduct = {
  externalId: string;
  title: string;
  price: number | null;
  brand?: string;
  description?: string;
  productUrl?: string;
  categoryPath: string[];
  categoryCode: string;
  attributes: Record<string, string | number | boolean>;
};

export type FleetFarmCategoryConfig = {
  code: string;
  name: string;
  /** Live listing URL — must not use disallowed robots.txt paths (/browse/, /search/). */
  listingUrl: string;
  maxProducts: number;
  categoryPath: string[];
};
