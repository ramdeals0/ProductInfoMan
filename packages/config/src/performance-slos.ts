export const PERFORMANCE_SLOS = {
  searchP95Ms: 300,
  categoryTreeP95Ms: 200,
  adminProductReadP95Ms: 400,
  adminProductWriteP95Ms: 500,
  importRowsPerJob: { min: 50_000, max: 100_000 },
  publishProductsPerJob: 10_000,
} as const;

export const LOAD_TEST_SCENARIOS = [
  "storefront-search",
  "admin-product-crud",
  "bulk-import",
  "publish-export",
  "mixed-workload",
] as const;
