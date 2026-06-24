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
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  parentId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  isActive: z.boolean().optional(),
});

export const CreateAttributeGroupSchema = z.object({
  name: z.string().min(1).max(128),
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(512).optional(),
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
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  allowedValuesType: z.enum(["FREE_TEXT", "CONTROLLED_LIST", "NUMERIC_RANGE"]).optional(),
});

export const LinkCategoryAttributesSchema = z.object({
  attributeDefinitionIds: z.array(z.string().cuid()).min(1),
  requirement: z.enum(["REQUIRED", "OPTIONAL", "HIDDEN"]).default("OPTIONAL"),
  inheritFromParent: z.boolean().default(true),
});

export const LinkCategoryAttributeGroupsSchema = z.object({
  attributeGroupIds: z.array(z.string().cuid()).min(1),
  sortOrder: z.number().int().optional(),
});

export const CreateFacetDefinitionSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(128),
  sourceAttributeId: z.string().cuid(),
  categoryId: z.string().cuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isDynamic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const ListFacetDefinitionsQuerySchema = z.object({
  categoryId: z.string().cuid().optional(),
});

export const CreateFacetRuleSchema = z.object({
  facetDefinitionId: z.string().cuid(),
  categoryId: z.string().cuid().nullable().optional(),
  attributeDefinitionId: z.string().cuid().nullable().optional(),
  ruleType: z.enum(["DIRECT", "NORMALIZE", "RANGE_BUCKET", "COMPOSITE"]).default("DIRECT"),
  ruleConfig: z.record(z.unknown()).nullable().optional(),
  priority: z.number().int().optional(),
});

export const ListFacetRulesQuerySchema = z.object({
  categoryId: z.string().cuid().optional(),
  facetDefinitionId: z.string().cuid().optional(),
});

export const UploadImportSchema = z.object({
  importTemplateId: z.string().cuid().optional(),
  importType: z.enum(["CREATE", "UPDATE", "UPSERT"]).optional(),
  duplicatePolicy: z.enum(["REJECT", "UPDATE", "SKIP"]).optional(),
  blankCellPolicy: z.enum(["IGNORE", "CLEAR"]).optional(),
});

export const ListImportsQuerySchema = z.object({
  status: z
    .enum([
      "UPLOADED",
      "VALIDATING",
      "VALIDATED",
      "VALIDATION_FAILED",
      "QUEUED",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const ImportTemplateMappingSchema = z.object({
  sourceColumn: z.string().min(1).max(64),
  targetField: z.string().min(1).max(64),
  transform: z.string().max(64).optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const CreateImportTemplateSchema = z.object({
  code: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  entityType: z.enum(["PRODUCT", "VARIANT", "CATEGORY"]).optional(),
  sourceFormat: z.string().max(32).optional(),
  configJson: z.record(z.unknown()).optional(),
  isDefault: z.boolean().optional(),
  mappings: z.array(ImportTemplateMappingSchema).min(1),
});

export const WorkflowStateInputSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  productStatus: ProductStatusSchema,
  isInitial: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const WorkflowTransitionInputSchema = z.object({
  fromStateCode: z.string().min(1),
  toStateCode: z.string().min(1),
  actionType: z.enum(["SUBMIT", "APPROVE", "REJECT", "PUBLISH", "RESUBMIT"]),
  allowedRoles: z.array(z.enum(["ADMIN", "CATALOG_MANAGER", "EDITOR", "REVIEWER", "VIEWER"])).min(1),
  requiresApproval: z.boolean().optional(),
  requiresJustification: z.boolean().optional(),
});

export const WorkflowAssignmentRuleInputSchema = z.object({
  name: z.string().min(1).max(128),
  assignToRole: z.enum(["ADMIN", "CATALOG_MANAGER", "EDITOR", "REVIEWER", "VIEWER"]),
  productTypes: z.array(ProductTypeSchema).optional(),
  categoryCodes: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
});

export const CreateWorkflowDefinitionSchema = z.object({
  code: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  entityType: z.enum(["PRODUCT", "CATEGORY"]).optional(),
  isActive: z.boolean().optional(),
  states: z.array(WorkflowStateInputSchema).min(2),
  transitions: z.array(WorkflowTransitionInputSchema).optional(),
  assignmentRules: z.array(WorkflowAssignmentRuleInputSchema).optional(),
});

export const WorkflowDecisionSchema = z.object({
  reason: z.string().max(1000).optional(),
  comments: z.string().max(2000).optional(),
});

export const WorkflowRejectSchema = WorkflowDecisionSchema.extend({
  reason: z.string().min(1).max(1000),
});

export const ListWorkflowTasksQuerySchema = z.object({
  status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]).optional(),
  assignedRole: z.enum(["ADMIN", "CATALOG_MANAGER", "EDITOR", "REVIEWER", "VIEWER"]).optional(),
});

export const SearchQuerySchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().cuid().optional(),
  categoryPath: z.string().optional(),
  filters: z.record(z.union([z.string(), z.array(z.string())])).optional(),
  groupByParent: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type SetAttributesInput = z.infer<typeof SetAttributesSchema>;
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateAttributeGroupInput = z.infer<typeof CreateAttributeGroupSchema>;
export type CreateAttributeInput = z.infer<typeof CreateAttributeSchema>;
export type LinkCategoryAttributesInput = z.infer<typeof LinkCategoryAttributesSchema>;
export type LinkCategoryAttributeGroupsInput = z.infer<typeof LinkCategoryAttributeGroupsSchema>;
export type CreateFacetDefinitionInput = z.infer<typeof CreateFacetDefinitionSchema>;
export type ListFacetDefinitionsQuery = z.infer<typeof ListFacetDefinitionsQuerySchema>;
export type CreateFacetRuleInput = z.infer<typeof CreateFacetRuleSchema>;
export type ListFacetRulesQuery = z.infer<typeof ListFacetRulesQuerySchema>;
export type UploadImportInput = z.infer<typeof UploadImportSchema>;
export type ListImportsQuery = z.infer<typeof ListImportsQuerySchema>;
export type CreateImportTemplateInput = z.infer<typeof CreateImportTemplateSchema>;
export type CreateWorkflowDefinitionInput = z.infer<typeof CreateWorkflowDefinitionSchema>;
export type WorkflowDecisionInput = z.infer<typeof WorkflowDecisionSchema>;
export type ListWorkflowTasksQuery = z.infer<typeof ListWorkflowTasksQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
