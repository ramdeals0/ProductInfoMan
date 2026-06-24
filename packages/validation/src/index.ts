import { z } from "zod";

export const ProductTypeSchema = z.enum(["SIMPLE", "PARENT", "VARIANT"]);
export const ProductStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISH_READY",
  "PUBLISHED",
  "REJECTED",
  "ARCHIVED",
]);
export const AttributeDataTypeSchema = z.enum([
  "TEXT",
  "RICH_TEXT",
  "NUMBER",
  "BOOLEAN",
  "ENUM",
  "DATE",
  "URL",
  "JSON",
]);

export const CreateProductSchema = z.object({
  productType: ProductTypeSchema,
  sku: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  brand: z.string().optional(),
  primaryCategoryId: z.string().cuid().optional(),
  parentId: z.string().cuid().optional(),
  secondaryCategoryIds: z.array(z.string().cuid()).optional(),
});

export const UpdateProductSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  primaryCategoryId: z.string().cuid().nullable().optional(),
  secondaryCategoryIds: z.array(z.string().cuid()).optional(),
});

export const CreateVariantSchema = z.object({
  sku: z.string().min(1).max(64),
  title: z.string().min(1).max(255).optional(),
  attributes: z.record(z.unknown()).default({}),
});

export const SetAttributesSchema = z.object({
  attributes: z.record(z.unknown()),
});

export const ListProductsQuerySchema = z.object({
  status: ProductStatusSchema.optional(),
  productType: ProductTypeSchema.optional(),
  sku: z.string().optional(),
  title: z.string().optional(),
  parentId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  parentId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const CreateAttributeGroupSchema = z.object({
  name: z.string().min(1).max(128),
  sortOrder: z.number().int().optional(),
});

export const CreateAttributeSchema = z.object({
  attributeGroupId: z.string().cuid(),
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(128),
  description: z.string().optional(),
  dataType: AttributeDataTypeSchema,
  isGlobal: z.boolean().optional(),
  isVariantAxis: z.boolean().optional(),
});

export const LinkCategoryAttributesSchema = z.object({
  attributeDefinitionIds: z.array(z.string().cuid()).min(1),
  requirement: z.enum(["REQUIRED", "OPTIONAL", "HIDDEN"]).default("OPTIONAL"),
  inheritFromParent: z.boolean().default(true),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type SetAttributesInput = z.infer<typeof SetAttributesSchema>;
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type CreateAttributeGroupInput = z.infer<typeof CreateAttributeGroupSchema>;
export type CreateAttributeInput = z.infer<typeof CreateAttributeSchema>;
export type LinkCategoryAttributesInput = z.infer<typeof LinkCategoryAttributesSchema>;
