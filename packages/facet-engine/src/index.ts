export type FacetRuleType = "DIRECT" | "NORMALIZE" | "RANGE_BUCKET" | "COMPOSITE";

export interface FacetRuleInput {
  ruleType: FacetRuleType;
  ruleConfig?: Record<string, unknown> | null;
  priority: number;
}

export interface FacetValueInput {
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface EnumValueInput {
  value: string;
  label: string;
  sortOrder: number;
}

export interface FacetDefinitionInput {
  key: string;
  label: string;
  sourceAttributeKey: string;
  isDynamic: boolean;
  sortOrder: number;
  rules: FacetRuleInput[];
  facetValues: FacetValueInput[];
  enumValues: EnumValueInput[];
}

export interface ResolvedFacetOption {
  value: string;
  label: string;
  sortOrder: number;
}

export interface ResolvedFacet {
  key: string;
  label: string;
  sourceAttributeKey: string;
  isDynamic: boolean;
  sortOrder: number;
  options: ResolvedFacetOption[];
  ruleType: FacetRuleType;
}

export function resolveFacetOptions(facet: FacetDefinitionInput): ResolvedFacetOption[] {
  const activeRule = [...facet.rules].sort((a, b) => b.priority - a.priority)[0];

      if (activeRule?.ruleType === "RANGE_BUCKET" && activeRule.ruleConfig?.buckets) {
    const buckets = activeRule.ruleConfig.buckets as Array<{
      value?: string;
      code?: string;
      label: string;
    }>;
    return buckets.map((bucket, index) => ({
      value: bucket.value ?? bucket.code ?? bucket.label,
      label: bucket.label,
      sortOrder: index,
    }));
  }

  if (facet.facetValues.length > 0) {
    return facet.facetValues
      .filter((value) => value.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((value) => ({
        value: value.value,
        label: value.label,
        sortOrder: value.sortOrder,
      }));
  }

  if (facet.enumValues.length > 0) {
    return facet.enumValues
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((value) => ({
        value: value.value,
        label: value.label,
        sortOrder: value.sortOrder,
      }));
  }

  if (facet.isDynamic) {
    return [];
  }

  return [];
}

export function resolveCategoryFacets(facets: FacetDefinitionInput[]): ResolvedFacet[] {
  return facets
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((facet) => {
      const activeRule = [...facet.rules].sort((a, b) => b.priority - a.priority)[0];
      return {
        key: facet.key,
        label: facet.label,
        sourceAttributeKey: facet.sourceAttributeKey,
        isDynamic: facet.isDynamic,
        sortOrder: facet.sortOrder,
        options: resolveFacetOptions(facet),
        ruleType: activeRule?.ruleType ?? "DIRECT",
      };
    });
}

type RangeBucket = {
  value?: string;
  code?: string;
  label: string;
  min: number | null;
  max: number | null;
};

function bucketValue(value: number, buckets: RangeBucket[]): string | null {
  for (const bucket of buckets) {
    const minOk = bucket.min == null || value >= bucket.min;
    const maxOk = bucket.max == null || value < bucket.max;
    if (minOk && maxOk) {
      return bucket.value ?? bucket.code ?? bucket.label;
    }
  }
  return null;
}

function normalizeStringValue(
  value: string,
  config: Record<string, unknown> | null | undefined,
): string {
  let result = value;
  if (config?.trim) result = result.trim();
  if (config?.case === "lower") result = result.toLowerCase();
  if (config?.case === "upper") result = result.toUpperCase();
  if (config?.case === "title") {
    result = result.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  const aliases = config?.aliases as Record<string, string> | undefined;
  if (aliases && aliases[result]) return aliases[result]!;
  return result;
}

/** Apply an approved facet rule to a raw attribute value for search projection. */
export function applyFacetRuleToValue(
  ruleType: FacetRuleType,
  ruleConfig: Record<string, unknown> | null | undefined,
  rawValue: unknown,
): string | null {
  if (rawValue == null || rawValue === "") return null;

  if (ruleType === "RANGE_BUCKET" && ruleConfig?.buckets) {
    const numeric = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (Number.isNaN(numeric)) return null;
    return bucketValue(numeric, ruleConfig.buckets as RangeBucket[]);
  }

  if (ruleType === "NORMALIZE") {
    const str = String(rawValue);
    return normalizeStringValue(str, ruleConfig);
  }

  if (typeof rawValue === "boolean") return rawValue ? "true" : "false";
  if (typeof rawValue === "number") return String(rawValue);
  if (typeof rawValue === "string") return rawValue;
  return JSON.stringify(rawValue);
}
