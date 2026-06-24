/**
 * FleetFarm-inspired demo catalog — attribute and facet seed configuration.
 *
 * Search projection note (implemented downstream):
 * - `price` numeric attribute values are bucketed via the `price` facet RANGE rule
 *   (Under $25, $25–$50, etc.) when building `facet_fields`.
 * - Other facets map directly from attribute values (brand, tool_type, …).
 */

export type AttributeDataTypeSeed =
  | "string"
  | "text"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "enum";

export type AttributeSeed = {
  code: string;
  name: string;
  dataType: AttributeDataTypeSeed;
  isRequired?: boolean;
  isVariantAttribute?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  /** Controlled list values when dataType = 'enum' */
  enumValues?: string[];
  /** Attribute group assignment */
  groupCode?: "general" | "specs" | "fit";
  /** Category codes this attribute applies to (empty = global) */
  categoryCodes?: string[];
};

export type FacetDefinitionSeed = {
  code: string;
  name: string;
  sourceAttributeCode: string;
  scope: "global" | "category";
  categoryCode?: string;
  displayOrder?: number;
};

export type FacetRuleSeed = {
  facetCode: string;
  ruleType: "range" | "normalize" | "include" | "exclude";
  ruleConfig: Record<string, unknown>;
};

export const PRICE_FACET_BUCKETS = [
  { code: "under_25", label: "Under $25", min: null, max: 25 },
  { code: "25_to_50", label: "$25 to $50", min: 25, max: 50 },
  { code: "50_to_100", label: "$50 to $100", min: 50, max: 100 },
  { code: "100_to_200", label: "$100 to $200", min: 100, max: 200 },
  { code: "200_plus", label: "$200 & Above", min: 200, max: null },
] as const;

export const attributeSeeds: AttributeSeed[] = [
  // Global
  {
    code: "brand",
    name: "Brand",
    dataType: "string",
    isFilterable: true,
    isSearchable: true,
    groupCode: "general",
  },
  {
    code: "price",
    name: "Price",
    dataType: "decimal",
    isFilterable: true,
    isSearchable: false,
    groupCode: "general",
  },
  {
    code: "rating",
    name: "Customer Rating",
    dataType: "decimal",
    isFilterable: true,
    groupCode: "general",
  },
  {
    code: "availability",
    name: "Availability",
    dataType: "enum",
    isFilterable: true,
    groupCode: "general",
    enumValues: ["In Stock", "Limited Stock", "Out of Stock"],
  },

  // Tools & Hardware
  {
    code: "tool_type",
    name: "Tool Type",
    dataType: "enum",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["tools"],
    enumValues: ["Drill", "Saw", "Grinder", "Hand Tools", "Measuring", "Storage", "Compressor"],
  },
  {
    code: "power_source",
    name: "Power Source",
    dataType: "enum",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["tools"],
    enumValues: ["Cordless", "Corded", "Manual", "Electric", "Battery"],
  },
  {
    code: "voltage",
    name: "Voltage",
    dataType: "integer",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["tools"],
  },

  // Outdoor Power
  {
    code: "equipment_type",
    name: "Equipment Type",
    dataType: "enum",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["outdoor_power"],
    enumValues: ["Chainsaw", "Mower", "Trimmer", "Blower", "Snow Blower", "Pressure Washer", "Tiller"],
  },
  {
    code: "engine_displacement_cc",
    name: "Engine Displacement (cc)",
    dataType: "integer",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["outdoor_power"],
  },
  {
    code: "bar_length_in",
    name: "Bar Length (in)",
    dataType: "integer",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["outdoor_power"],
  },
  {
    code: "fuel_type",
    name: "Fuel Type",
    dataType: "enum",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["outdoor_power"],
    enumValues: ["Gas", "Battery", "Electric", "Manual"],
  },

  // Clothing
  {
    code: "apparel_gender",
    name: "Gender",
    dataType: "enum",
    isFilterable: true,
    groupCode: "fit",
    categoryCodes: ["clothing"],
    enumValues: ["Men", "Women", "Unisex", "Youth"],
  },
  {
    code: "apparel_size",
    name: "Size",
    dataType: "enum",
    isFilterable: true,
    isVariantAttribute: true,
    groupCode: "fit",
    categoryCodes: ["clothing"],
    enumValues: ["XS", "S", "M", "L", "XL", "One Size"],
  },
  {
    code: "color",
    name: "Color",
    dataType: "enum",
    isFilterable: true,
    isVariantAttribute: true,
    groupCode: "fit",
    categoryCodes: ["clothing"],
    enumValues: ["Black", "Blue", "Brown", "Gray", "Green", "Red", "Tan", "Yellow"],
  },
  {
    code: "apparel_type",
    name: "Apparel Type",
    dataType: "enum",
    isFilterable: true,
    groupCode: "fit",
    categoryCodes: ["clothing"],
    enumValues: ["Jacket", "Pants", "Boots", "Gloves", "Shirt", "Coveralls", "Accessories"],
  },

  // Fishing / Hunting (optional)
  {
    code: "category_subtype",
    name: "Subtype",
    dataType: "enum",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["fishing"],
    enumValues: ["Rod", "Reel", "Lure", "Tackle", "Hunting", "Electronics", "Apparel"],
  },
  {
    code: "caliber_or_line_rating",
    name: "Caliber / Line Rating",
    dataType: "string",
    isFilterable: true,
    groupCode: "specs",
    categoryCodes: ["fishing"],
  },
];

export const facetDefinitionSeeds: FacetDefinitionSeed[] = [
  // Global facets
  { code: "brand", name: "Brand", sourceAttributeCode: "brand", scope: "global", displayOrder: 1 },
  { code: "price", name: "Price", sourceAttributeCode: "price", scope: "global", displayOrder: 2 },
  { code: "rating", name: "Customer Rating", sourceAttributeCode: "rating", scope: "global", displayOrder: 3 },
  {
    code: "availability",
    name: "Availability",
    sourceAttributeCode: "availability",
    scope: "global",
    displayOrder: 4,
  },

  // Tools
  {
    code: "tool_type",
    name: "Tool Type",
    sourceAttributeCode: "tool_type",
    scope: "category",
    categoryCode: "tools",
    displayOrder: 10,
  },
  {
    code: "power_source",
    name: "Power Source",
    sourceAttributeCode: "power_source",
    scope: "category",
    categoryCode: "tools",
    displayOrder: 11,
  },
  {
    code: "voltage",
    name: "Voltage",
    sourceAttributeCode: "voltage",
    scope: "category",
    categoryCode: "tools",
    displayOrder: 12,
  },

  // Outdoor power
  {
    code: "equipment_type",
    name: "Equipment Type",
    sourceAttributeCode: "equipment_type",
    scope: "category",
    categoryCode: "outdoor_power",
    displayOrder: 10,
  },
  {
    code: "bar_length_in",
    name: "Bar Length",
    sourceAttributeCode: "bar_length_in",
    scope: "category",
    categoryCode: "outdoor_power",
    displayOrder: 11,
  },
  {
    code: "fuel_type",
    name: "Fuel Type",
    sourceAttributeCode: "fuel_type",
    scope: "category",
    categoryCode: "outdoor_power",
    displayOrder: 12,
  },

  // Clothing
  {
    code: "apparel_gender",
    name: "Gender",
    sourceAttributeCode: "apparel_gender",
    scope: "category",
    categoryCode: "clothing",
    displayOrder: 10,
  },
  {
    code: "apparel_size",
    name: "Size",
    sourceAttributeCode: "apparel_size",
    scope: "category",
    categoryCode: "clothing",
    displayOrder: 11,
  },
  {
    code: "color",
    name: "Color",
    sourceAttributeCode: "color",
    scope: "category",
    categoryCode: "clothing",
    displayOrder: 12,
  },
  {
    code: "apparel_type",
    name: "Apparel Type",
    sourceAttributeCode: "apparel_type",
    scope: "category",
    categoryCode: "clothing",
    displayOrder: 13,
  },

  // Fishing (optional)
  {
    code: "category_subtype",
    name: "Subtype",
    sourceAttributeCode: "category_subtype",
    scope: "category",
    categoryCode: "fishing",
    displayOrder: 10,
  },
];

export const facetRuleSeeds: FacetRuleSeed[] = [
  {
    facetCode: "price",
    ruleType: "range",
    ruleConfig: {
      buckets: PRICE_FACET_BUCKETS,
    },
  },
  {
    facetCode: "brand",
    ruleType: "normalize",
    ruleConfig: {
      trim: true,
      case: "title",
    },
  },
  {
    facetCode: "availability",
    ruleType: "include",
    ruleConfig: {
      values: ["In Stock", "Limited Stock"],
    },
  },
];

/** Demo category codes expected by facet seeds */
export const DEMO_CATEGORY_SEEDS = [
  { code: "tools", name: "Tools & Hardware" },
  { code: "outdoor_power", name: "Outdoor Power Equipment" },
  { code: "clothing", name: "Clothing & Workwear" },
  { code: "fishing", name: "Fishing & Hunting" },
] as const;

/** Resolve a numeric price to a configured bucket code. */
export function priceToBucketCode(price: number): (typeof PRICE_FACET_BUCKETS)[number]["code"] {
  if (price < 25) return "under_25";
  if (price < 50) return "25_to_50";
  if (price < 100) return "50_to_100";
  if (price < 200) return "100_to_200";
  return "200_plus";
}

/** Resolve a numeric price to a configured bucket label (for search projection / fixtures). */
export function priceToBucketLabel(price: number): string {
  const code = priceToBucketCode(price);
  return PRICE_FACET_BUCKETS.find((bucket) => bucket.code === code)?.label ?? "Unknown";
}

/** Deterministic demo rating from a product seed string. */
export function simulatedRating(seed: string): number {
  const hash = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Math.round((3.5 + (hash % 16) / 10) * 10) / 10;
}
