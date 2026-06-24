export type FacetSeedDefinition = {
  code: string;
  name: string;
  sourceAttributeCode: string;
  scope: "global" | "category";
  categoryCode?: string;
  sortOrder: number;
  ruleType?: "DIRECT" | "NORMALIZE" | "RANGE_BUCKET";
};

/** Amazon-style facet sidebar configuration for the Fleet Farm demo catalog. */
export const DEMO_FACET_DEFINITIONS: FacetSeedDefinition[] = [
  { code: "brand", name: "Brand", sourceAttributeCode: "brand", scope: "global", sortOrder: 1 },
  {
    code: "price_range",
    name: "Price",
    sourceAttributeCode: "price_range",
    scope: "global",
    sortOrder: 2,
    ruleType: "DIRECT",
  },
  {
    code: "rating",
    name: "Customer Rating",
    sourceAttributeCode: "rating",
    scope: "global",
    sortOrder: 3,
  },
  {
    code: "availability",
    name: "Availability",
    sourceAttributeCode: "availability",
    scope: "global",
    sortOrder: 4,
  },
  {
    code: "tool_type",
    name: "Tool Type",
    sourceAttributeCode: "tool_type",
    scope: "category",
    categoryCode: "tools-hardware",
    sortOrder: 10,
  },
  {
    code: "power_source",
    name: "Power Source",
    sourceAttributeCode: "power_source",
    scope: "category",
    categoryCode: "tools-hardware",
    sortOrder: 11,
  },
  {
    code: "engine_displacement",
    name: "Engine Displacement",
    sourceAttributeCode: "engine_displacement",
    scope: "category",
    categoryCode: "outdoor-power",
    sortOrder: 10,
  },
  {
    code: "bar_length",
    name: "Bar Length",
    sourceAttributeCode: "bar_length",
    scope: "category",
    categoryCode: "outdoor-power",
    sortOrder: 11,
  },
  {
    code: "fuel_type",
    name: "Fuel Type",
    sourceAttributeCode: "fuel_type",
    scope: "category",
    categoryCode: "outdoor-power",
    sortOrder: 12,
  },
  {
    code: "workwear_size",
    name: "Size",
    sourceAttributeCode: "size",
    scope: "category",
    categoryCode: "clothing-workwear",
    sortOrder: 10,
  },
  {
    code: "gender",
    name: "Gender",
    sourceAttributeCode: "gender",
    scope: "category",
    categoryCode: "clothing-workwear",
    sortOrder: 11,
  },
  {
    code: "workwear_color",
    name: "Color",
    sourceAttributeCode: "color",
    scope: "category",
    categoryCode: "clothing-workwear",
    sortOrder: 12,
  },
  {
    code: "gear_type",
    name: "Gear Type",
    sourceAttributeCode: "gear_type",
    scope: "category",
    categoryCode: "fishing-hunting",
    sortOrder: 10,
  },
  {
    code: "species",
    name: "Species",
    sourceAttributeCode: "species",
    scope: "category",
    categoryCode: "fishing-hunting",
    sortOrder: 11,
  },
];

export type AttributeSeedDefinition = {
  key: string;
  label: string;
  groupCode: "general" | "specs" | "fit";
  dataType: "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN";
  isGlobal?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  allowedValues?: string[];
  categoryCodes?: string[];
};

export const DEMO_ATTRIBUTE_DEFINITIONS: AttributeSeedDefinition[] = [
  {
    key: "brand",
    label: "Brand",
    groupCode: "general",
    dataType: "TEXT",
    isGlobal: true,
    isFilterable: true,
    isSearchable: true,
  },
  {
    key: "price",
    label: "Price",
    groupCode: "general",
    dataType: "NUMBER",
    isGlobal: true,
    isFilterable: true,
  },
  {
    key: "price_range",
    label: "Price Range",
    groupCode: "general",
    dataType: "ENUM",
    isGlobal: true,
    isFilterable: true,
    allowedValues: ["Under $25", "$25 - $50", "$50 - $100", "$100 - $250", "$250+"],
  },
  {
    key: "rating",
    label: "Rating",
    groupCode: "general",
    dataType: "NUMBER",
    isGlobal: true,
    isFilterable: true,
  },
  {
    key: "availability",
    label: "Availability",
    groupCode: "general",
    dataType: "ENUM",
    isGlobal: true,
    isFilterable: true,
    allowedValues: ["In Stock", "Limited Stock", "Out of Stock"],
  },
  { key: "tool_type", label: "Tool Type", groupCode: "specs", dataType: "ENUM", isFilterable: true, categoryCodes: ["tools-hardware"] },
  { key: "power_source", label: "Power Source", groupCode: "specs", dataType: "ENUM", isFilterable: true, categoryCodes: ["tools-hardware"] },
  { key: "engine_displacement", label: "Engine Displacement", groupCode: "specs", dataType: "TEXT", isFilterable: true, categoryCodes: ["outdoor-power"] },
  { key: "bar_length", label: "Bar Length", groupCode: "specs", dataType: "TEXT", isFilterable: true, categoryCodes: ["outdoor-power"] },
  { key: "fuel_type", label: "Fuel Type", groupCode: "specs", dataType: "ENUM", isFilterable: true, categoryCodes: ["outdoor-power"] },
  { key: "size", label: "Size", groupCode: "fit", dataType: "ENUM", isFilterable: true, categoryCodes: ["clothing-workwear"] },
  { key: "gender", label: "Gender", groupCode: "fit", dataType: "ENUM", isFilterable: true, categoryCodes: ["clothing-workwear"] },
  { key: "color", label: "Color", groupCode: "fit", dataType: "ENUM", isFilterable: true, categoryCodes: ["clothing-workwear"] },
  { key: "gear_type", label: "Gear Type", groupCode: "specs", dataType: "ENUM", isFilterable: true, categoryCodes: ["fishing-hunting"] },
  { key: "species", label: "Species", groupCode: "specs", dataType: "ENUM", isFilterable: true, categoryCodes: ["fishing-hunting"] },
];

export function toPriceRange(price: number): string {
  if (price < 25) return "Under $25";
  if (price < 50) return "$25 - $50";
  if (price < 100) return "$50 - $100";
  if (price < 250) return "$100 - $250";
  return "$250+";
}

export function simulatedRating(seed: string): number {
  const hash = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Math.round((3.5 + (hash % 16) / 10) * 10) / 10;
}
