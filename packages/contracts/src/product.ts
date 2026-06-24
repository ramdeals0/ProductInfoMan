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
export const AttributeSourceSchema = z.enum(["LOCAL", "INHERITED", "OVERRIDDEN"]);

export const CreateProductSchema = z.object({
  productType: ProductTypeSchema,
  sku: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  brand: z.string().optional(),
  primaryCategoryId: z.string().cuid().optional(),
  parentId: z.string().cuid().optional(),
});

export const UpdateProductSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  primaryCategoryId: z.string().cuid().nullable().optional(),
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

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type SetAttributesInput = z.infer<typeof SetAttributesSchema>;
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;

export interface ResolvedAttribute {
  key: string;
  attributeDefinitionId: string;
  value: unknown;
  source: z.infer<typeof AttributeSourceSchema>;
}

export interface ProductDto {
  id: string;
  organizationId: string;
  productType: z.infer<typeof ProductTypeSchema>;
  sku: string;
  parentId: string | null;
  status: z.infer<typeof ProductStatusSchema>;
  title: string;
  description: string | null;
  brand: string | null;
  primaryCategoryId: string | null;
  attributes: ResolvedAttribute[];
  createdAt: string;
  updatedAt: string;
}
