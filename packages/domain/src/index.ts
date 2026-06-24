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
  name: string;
  slug: string;
  path: string;
  depth: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttributeGroupEntity {
  id: string;
  organizationId: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
}
