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
    const buckets = activeRule.ruleConfig.buckets as Array<{ value: string; label: string }>;
    return buckets.map((bucket, index) => ({
      value: bucket.value,
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
