import type { ProductStatus, ProductType } from "./types.js";
import { isStorefrontVisible } from "@productinfoman/domain";
import { applyFacetRuleToValue } from "@productinfoman/facet-engine";

export type IndexableProductStatus = Extract<ProductStatus, "APPROVED" | "PUBLISH_READY" | "PUBLISHED">;

export interface SearchDocument {
  product_id: string;
  organization_id: string;
  sku: string;
  parent_product_id: string | null;
  group_key: string;
  product_type: ProductType;
  title: string;
  brand: string | null;
  description: string | null;
  summary: string | null;
  selling_points: string[];
  category_ids: string[];
  category_paths: string[];
  variant_attributes: Record<string, unknown>;
  filterable_attributes: Record<string, unknown>;
  sortable_attributes: Record<string, string | number>;
  facet_fields: Record<string, string | string[]>;
  status: ProductStatus;
  published_at: string | null;
  start_date: string | null;
  discontinue_date: string | null;
  storefront_active: boolean;
  channel_availability: Record<string, boolean>;
  search_text: string;
}

export interface ProjectionAttributeDefinition {
  id: string;
  key: string;
  dataType: string;
  isVariantAxis: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
}

export interface ProjectionAttributeValue {
  key: string;
  attributeDefinitionId: string;
  value: unknown;
}

export interface ProjectionCategory {
  id: string;
  path: string;
}

export interface ProjectionFacetDefinition {
  key: string;
  label: string;
  sourceAttributeKey: string;
  ruleType?: "DIRECT" | "NORMALIZE" | "RANGE_BUCKET" | "COMPOSITE";
  ruleConfig?: Record<string, unknown> | null;
}

export interface BuildSearchDocumentInput {
  organizationId: string;
  productId: string;
  sku: string;
  parentProductId: string | null;
  productType: ProductType;
  title: string;
  brand: string | null;
  description: string | null;
  summary: string | null;
  sellingPoints: string[];
  status: ProductStatus;
  publishedAt: Date | null;
  startDate: Date | null;
  discontinueDate: Date | null;
  primaryCategory: ProjectionCategory | null;
  secondaryCategories: ProjectionCategory[];
  attributes: ProjectionAttributeValue[];
  attributeDefinitions: ProjectionAttributeDefinition[];
  facetDefinitions: ProjectionFacetDefinition[];
}

export interface SearchQueryInput {
  q?: string;
  categoryId?: string;
  categoryPath?: string;
  filters?: Record<string, string | string[]>;
  groupByParent?: boolean;
  storefront?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface SearchHit {
  product_id: string;
  sku: string;
  title: string;
  brand: string | null;
  status: ProductStatus;
  parent_product_id: string | null;
  group_key: string;
  category_ids: string[];
  facet_fields: Record<string, string | string[]>;
  score?: number;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface FacetAggregation {
  key: string;
  buckets: FacetBucket[];
}

export interface SearchQueryResult {
  total: number;
  page: number;
  pageSize: number;
  items: SearchHit[];
  groups?: Array<{ group_key: string; items: SearchHit[] }>;
}

export interface FacetQueryResult {
  facets: FacetAggregation[];
  total: number;
}

export const INDEXABLE_STATUSES: IndexableProductStatus[] = ["APPROVED", "PUBLISH_READY", "PUBLISHED"];

export function isIndexableStatus(status: ProductStatus): status is IndexableProductStatus {
  return INDEXABLE_STATUSES.includes(status as IndexableProductStatus);
}

export function defaultIndexName(organizationId: string): string {
  return `products-${organizationId}`.toLowerCase();
}

export const PRODUCT_SEARCH_INDEX_MAPPING = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      analyzer: {
        product_text: {
          type: "custom" as const,
          tokenizer: "standard",
          filter: ["lowercase", "asciifolding"],
        },
      },
    },
  },
  mappings: {
    properties: {
      product_id: { type: "keyword" },
      organization_id: { type: "keyword" },
      sku: { type: "keyword" },
      parent_product_id: { type: "keyword" },
      group_key: { type: "keyword" },
      product_type: { type: "keyword" },
      title: { type: "text", analyzer: "product_text", fields: { keyword: { type: "keyword" } } },
      brand: { type: "keyword" },
      description: { type: "text", analyzer: "product_text" },
      category_ids: { type: "keyword" },
      category_paths: { type: "keyword" },
      variant_attributes: { type: "object", enabled: true },
      filterable_attributes: { type: "object", enabled: true },
      sortable_attributes: { type: "object", enabled: true },
      facet_fields: { type: "object", enabled: true },
      status: { type: "keyword" },
      published_at: { type: "date" },
      channel_availability: { type: "object", enabled: true },
      search_text: { type: "text", analyzer: "product_text" },
    },
  },
} as const;

export function buildFacetFields(
  attributes: ProjectionAttributeValue[],
  facetDefinitions: ProjectionFacetDefinition[],
): Record<string, string> {
  const attrByKey = new Map(attributes.map((attr) => [attr.key, attr]));
  const facetFields: Record<string, string> = {};

  for (const facet of facetDefinitions) {
    const attr = attrByKey.get(facet.sourceAttributeKey);
    if (!attr) continue;
    const facetValue = facet.ruleType
      ? applyFacetRuleToValue(facet.ruleType, facet.ruleConfig ?? null, attr.value)
      : normalizeFacetValue(attr.value);
    if (facetValue) {
      facetFields[facet.key] = facetValue;
    }
  }

  return facetFields;
}

function normalizeFacetValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function toSortableValue(value: unknown): string | number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && value.trim() !== "") return asNumber;
    return value;
  }
  return String(value);
}

function buildSearchText(input: BuildSearchDocumentInput): string {
  const parts = [input.sku, input.title, input.brand, input.description, input.summary]
    .filter((part): part is string => typeof part === "string" && part.length > 0);

  for (const point of input.sellingPoints) {
    if (point.trim()) parts.push(point);
  }

  for (const attr of input.attributes) {
    const def = input.attributeDefinitions.find((d) => d.key === attr.key);
    if (def?.isSearchable) {
      const normalized = normalizeFacetValue(attr.value);
      if (normalized) parts.push(normalized);
    }
  }

  return parts.join(" ").toLowerCase();
}

function buildChannelAvailability(status: ProductStatus): Record<string, boolean> {
  return {
    web: status === "PUBLISHED" || status === "PUBLISH_READY",
    marketplace: status === "PUBLISHED",
    b2b: status === "PUBLISHED" || status === "APPROVED",
  };
}

export function buildSearchDocument(input: BuildSearchDocumentInput): SearchDocument | null {
  if (!isIndexableStatus(input.status)) {
    return null;
  }

  const categoryIds = [
    ...(input.primaryCategory ? [input.primaryCategory.id] : []),
    ...input.secondaryCategories.map((c) => c.id),
  ];
  const categoryPaths = [
    ...(input.primaryCategory ? [input.primaryCategory.path] : []),
    ...input.secondaryCategories.map((c) => c.path),
  ];

  const defByKey = new Map(input.attributeDefinitions.map((d) => [d.key, d]));

  const variantAttributes: Record<string, unknown> = {};
  const filterableAttributes: Record<string, unknown> = {};
  const sortableAttributes: Record<string, string | number> = {};
  const facetFields: Record<string, string | string[]> = {};

  for (const attr of input.attributes) {
    const def = defByKey.get(attr.key);
    if (!def) continue;

    if (def.isVariantAxis) {
      variantAttributes[attr.key] = attr.value;
    }
    if (def.isFilterable) {
      filterableAttributes[attr.key] = attr.value;
    }
    const sortable = toSortableValue(attr.value);
    if (sortable != null) {
      sortableAttributes[attr.key] = sortable;
    }
  }

  sortableAttributes.title = input.title.toLowerCase();
  if (input.brand) sortableAttributes.brand = input.brand.toLowerCase();
  sortableAttributes.sku = input.sku;

  Object.assign(facetFields, buildFacetFields(input.attributes, input.facetDefinitions));

  const storefrontActive = isStorefrontVisible({
    status: input.status,
    startDate: input.startDate,
    discontinueDate: input.discontinueDate,
  });

  return {
    product_id: input.productId,
    organization_id: input.organizationId,
    sku: input.sku,
    parent_product_id: input.parentProductId,
    group_key: input.parentProductId ?? input.productId,
    product_type: input.productType,
    title: input.title,
    brand: input.brand,
    description: input.description,
    summary: input.summary,
    selling_points: input.sellingPoints,
    category_ids: [...new Set(categoryIds)],
    category_paths: [...new Set(categoryPaths)],
    variant_attributes: variantAttributes,
    filterable_attributes: filterableAttributes,
    sortable_attributes: sortableAttributes,
    facet_fields: facetFields,
    status: input.status,
    published_at: input.publishedAt?.toISOString() ?? null,
    start_date: input.startDate?.toISOString() ?? null,
    discontinue_date: input.discontinueDate?.toISOString() ?? null,
    storefront_active: storefrontActive,
    channel_availability: buildChannelAvailability(input.status),
    search_text: buildSearchText(input),
  };
}

export function aggregateFacets(
  documents: SearchDocument[],
  facetKeys: string[],
): FacetAggregation[] {
  const counts = new Map<string, Map<string, number>>();

  for (const key of facetKeys) {
    counts.set(key, new Map());
  }

  for (const doc of documents) {
    for (const key of facetKeys) {
      const raw = doc.facet_fields[key];
      if (raw == null) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      const bucket = counts.get(key)!;
      for (const value of values) {
        bucket.set(value, (bucket.get(value) ?? 0) + 1);
      }
    }
  }

  return facetKeys.map((key) => ({
    key,
    buckets: [...(counts.get(key)?.entries() ?? [])]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
  }));
}

export function matchesSearchQuery(doc: SearchDocument, query: SearchQueryInput): boolean {
  if (query.storefront) {
    const visible = isStorefrontVisible({
      status: doc.status,
      startDate: doc.start_date ? new Date(doc.start_date) : null,
      discontinueDate: doc.discontinue_date ? new Date(doc.discontinue_date) : null,
    });
    if (!visible) return false;
  }

  if (query.q) {
    const needle = query.q.toLowerCase();
    if (!doc.search_text.includes(needle) && !doc.title.toLowerCase().includes(needle)) {
      return false;
    }
  }

  if (query.categoryPath) {
    const hasPath = doc.category_paths.some(
      (path) => path === query.categoryPath || path.startsWith(`${query.categoryPath}/`),
    );
    if (!hasPath) return false;
  } else if (query.categoryId && !doc.category_ids.includes(query.categoryId)) {
    return false;
  }

  if (query.filters) {
    for (const [key, expected] of Object.entries(query.filters)) {
      const actual = doc.facet_fields[key] ?? doc.filterable_attributes[key];
      if (actual == null) return false;
      const expectedValues = Array.isArray(expected) ? expected : [expected];
      const actualValues = Array.isArray(actual) ? actual.map(String) : [String(actual)];
      if (!expectedValues.some((value) => actualValues.includes(value))) {
        return false;
      }
    }
  }

  return true;
}

export function toSearchHit(doc: SearchDocument): SearchHit {
  return {
    product_id: doc.product_id,
    sku: doc.sku,
    title: doc.title,
    brand: doc.brand,
    status: doc.status,
    parent_product_id: doc.parent_product_id,
    group_key: doc.group_key,
    category_ids: doc.category_ids,
    facet_fields: doc.facet_fields,
  };
}
