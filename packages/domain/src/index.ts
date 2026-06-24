export type ProductType = "SIMPLE" | "PARENT" | "VARIANT";
export type ProductStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISH_READY"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";
export type AttributeSource = "LOCAL" | "INHERITED" | "OVERRIDDEN";
export type AttributeDataType =
  | "TEXT"
  | "RICH_TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "ENUM"
  | "DATE"
  | "URL"
  | "JSON";
export type AllowedValuesType = "FREE_TEXT" | "CONTROLLED_LIST" | "NUMERIC_RANGE";
export type CategoryStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type FacetScope = "GLOBAL" | "CATEGORY";
export type FacetRuleType = "DIRECT" | "NORMALIZE" | "RANGE_BUCKET" | "COMPOSITE";
export type ProductRelationshipType =
  | "VARIANT_OF"
  | "BUNDLE_COMPONENT"
  | "ACCESSORY"
  | "REPLACEMENT"
  | "COLLECTION_MEMBER";

export interface ResolvedAttribute {
  key: string;
  attributeDefinitionId: string;
  value: unknown;
  source: AttributeSource;
}

export interface ProductEntity {
  id: string;
  organizationId: string;
  productType: ProductType;
  sku: string;
  parentId: string | null;
  status: ProductStatus;
  title: string;
  description: string | null;
  brand: string | null;
  primaryCategoryId: string | null;
  attributes: ResolvedAttribute[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductTreeNode extends ProductEntity {
  children: ProductEntity[];
}

export interface CategoryEntity {
  id: string;
  organizationId: string;
  parentId: string | null;
  code: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  sortOrder: number;
  status: CategoryStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNode extends CategoryEntity {
  children: CategoryTreeNode[];
}

export interface AttributeGroupEntity {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttributeEntity {
  id: string;
  organizationId: string;
  attributeGroupId: string;
  key: string;
  label: string;
  description: string | null;
  dataType: AttributeDataType;
  isGlobal: boolean;
  isVariantAxis: boolean;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  allowedValuesType: AllowedValuesType;
  createdAt: string;
  updatedAt: string;
}

export interface FacetDefinitionEntity {
  id: string;
  organizationId: string;
  key: string;
  label: string;
  sourceAttributeId: string;
  sourceAttributeKey: string;
  categoryId: string | null;
  scope: FacetScope;
  sortOrder: number;
  isDynamic: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FacetRuleEntity {
  id: string;
  organizationId: string;
  categoryId: string | null;
  attributeDefinitionId: string | null;
  facetDefinitionId: string;
  ruleType: FacetRuleType;
  ruleConfig: Record<string, unknown> | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryFacetEntity {
  key: string;
  label: string;
  sourceAttributeKey: string;
  isDynamic: boolean;
  sortOrder: number;
  ruleType: FacetRuleType;
  options: Array<{
    value: string;
    label: string;
    sortOrder: number;
  }>;
}
