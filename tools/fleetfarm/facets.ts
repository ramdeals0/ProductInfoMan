/**
 * @deprecated Import from `@productinfoman/config/facets` or `packages/config/facets.config.ts`.
 * Re-exports shared facet config helpers for backward compatibility.
 */
export {
  attributeSeeds,
  facetDefinitionSeeds,
  facetRuleSeeds,
  PRICE_FACET_BUCKETS,
  DEMO_CATEGORY_SEEDS,
  priceToBucketCode,
  priceToBucketLabel,
  priceToBucketLabel as toPriceRange,
  simulatedRating,
} from "../../packages/config/facets.config.js";
