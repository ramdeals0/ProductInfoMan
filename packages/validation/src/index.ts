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
  summary: z.string().max(500).optional(),
  sellingPoints: z.array(z.string().min(1).max(240)).max(10).optional(),
  brand: z.string().optional(),
  primaryCategoryId: z.string().cuid().optional(),
  parentId: z.string().cuid().optional(),
  secondaryCategoryIds: z.array(z.string().cuid()).optional(),
  startDate: z.coerce.date().optional(),
  discontinueDate: z.coerce.date().optional(),
});

export const UpdateProductSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  summary: z.string().max(500).nullable().optional(),
  sellingPoints: z.array(z.string().min(1).max(240)).max(10).optional(),
  brand: z.string().optional(),
  primaryCategoryId: z.string().cuid().nullable().optional(),
  secondaryCategoryIds: z.array(z.string().cuid()).optional(),
  startDate: z.coerce.date().nullable().optional(),
  discontinueDate: z.coerce.date().nullable().optional(),
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

export const UpdateAttributeGroupSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(512).nullable().optional(),
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

export const UpdateAttributeSchema = z.object({
  label: z.string().min(1).max(128).optional(),
  description: z.string().nullable().optional(),
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

export const UpdateFacetDefinitionSchema = z.object({
  label: z.string().min(1).max(128).optional(),
  sortOrder: z.number().int().optional(),
  isDynamic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().cuid().nullable().optional(),
});

export const ListFacetDefinitionsQuerySchema = z.object({
  categoryId: z.string().cuid().optional(),
  includeInactive: z.coerce.boolean().optional(),
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
  sourceSystem: z.string().min(1).max(64).optional(),
  fileType: z.enum(["CSV", "XML", "JSON"]).optional(),
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

export const ListImportRowsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
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
  storefront: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const CreateChannelSchema = z.object({
  code: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(128),
  type: z.enum(["ECOMMERCE", "MARKETPLACE", "B2B", "CUSTOM"]).optional(),
  destinationType: z.enum(["CSV", "JSON", "HTTP_WEBHOOK", "SFTP"]).optional(),
  configJson: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const CreateChannelFieldMappingSchema = z.object({
  sourceField: z.string().min(1).max(128),
  targetField: z.string().min(1).max(128),
  transformType: z.enum(["DIRECT", "TEMPLATE", "CONCAT", "LOOKUP", "DEFAULT"]).optional(),
  transformConfigJson: z.record(z.unknown()).nullable().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const PublishRunSchema = z.object({
  channelId: z.string().cuid(),
  productIds: z.array(z.string().cuid()).optional(),
});

export const ListPublishJobsQuerySchema = z.object({
  channelId: z.string().cuid().optional(),
  status: z.enum(["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "RETRYING"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListOutboxEventsQuerySchema = z.object({
  eventType: z.string().optional(),
  status: z.enum(["PENDING", "PUBLISHED", "FAILED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const ListDeadLetterEventsQuerySchema = z.object({
  consumerName: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const ReplayEventsSchema = z.object({
  eventType: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const ListAuditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  productId: z.string().cuid().optional(),
  performedBy: z.string().cuid().optional(),
  action: z.enum(["CREATE", "UPDATE", "DELETE", "STATE_CHANGE", "IMPORT", "EXPORT"]).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const ReportPeriodQuerySchema = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});

const SurvivorshipRuleConfigSchema = z.discriminatedUnion("ruleType", [
  z.object({
    ruleType: z.literal("SOURCE_PRIORITY"),
    ruleConfigJson: z.object({
      source_priority: z.array(z.string().min(1)).min(1),
    }),
  }),
  z.object({
    ruleType: z.literal("MOST_RECENT"),
    ruleConfigJson: z.object({}).passthrough().optional(),
  }),
  z.object({
    ruleType: z.literal("MOST_COMPLETE"),
    ruleConfigJson: z.object({}).passthrough().optional(),
  }),
]);

export const CreateProductSystemIdSchema = z.object({
  systemCode: z.string().min(1).max(64),
  externalKey: z.string().min(1).max(256),
  isPrimary: z.boolean().optional(),
});

export const RegisterSourceRecordSchema = z.object({
  sourceSystem: z.string().min(1).max(64),
  sourceRecordId: z.string().min(1).max(256),
  rawPayloadJson: z.record(z.unknown()),
  normalizedPayloadJson: z.record(z.unknown()).optional(),
});

export const InboundProductSchema = z.object({
  sourceSystem: z.string().min(1).max(64),
  sourceRecordId: z.string().min(1).max(256),
  payload: z.record(z.unknown()),
  createIfUnmatched: z.boolean().optional(),
});

export const DefineSurvivorshipRuleSchema = z
  .object({
    code: z.string().min(1).max(64),
    name: z.string().min(1).max(128),
    entityType: z.string().min(1).max(64).default("product"),
    attributeCode: z.string().min(1).max(128),
    ruleType: z.enum(["SOURCE_PRIORITY", "MOST_RECENT", "MOST_COMPLETE"]),
    ruleConfigJson: z.record(z.unknown()),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.ruleType === "SOURCE_PRIORITY") {
      const priorities = (value.ruleConfigJson as { source_priority?: unknown }).source_priority;
      if (!Array.isArray(priorities) || priorities.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "source_priority must be a non-empty array for SOURCE_PRIORITY rules",
          path: ["ruleConfigJson"],
        });
      }
    }
  });

export const ResolveMatchDecisionSchema = z.object({
  productId: z.string().cuid().optional(),
  action: z.enum(["link", "ignore", "create_new_product"]),
});

export const ListSourceRecordsQuerySchema = z.object({
  sourceSystem: z.string().optional(),
  status: z.enum(["UNMATCHED", "MATCHED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateVariantInput = z.infer<typeof CreateVariantSchema>;
export type SetAttributesInput = z.infer<typeof SetAttributesSchema>;
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateAttributeGroupInput = z.infer<typeof CreateAttributeGroupSchema>;
export type UpdateAttributeGroupInput = z.infer<typeof UpdateAttributeGroupSchema>;
export type CreateAttributeInput = z.infer<typeof CreateAttributeSchema>;
export type UpdateAttributeInput = z.infer<typeof UpdateAttributeSchema>;
export type LinkCategoryAttributesInput = z.infer<typeof LinkCategoryAttributesSchema>;
export type LinkCategoryAttributeGroupsInput = z.infer<typeof LinkCategoryAttributeGroupsSchema>;
export type CreateFacetDefinitionInput = z.infer<typeof CreateFacetDefinitionSchema>;
export type UpdateFacetDefinitionInput = z.infer<typeof UpdateFacetDefinitionSchema>;
export type ListFacetDefinitionsQuery = z.infer<typeof ListFacetDefinitionsQuerySchema>;
export type CreateFacetRuleInput = z.infer<typeof CreateFacetRuleSchema>;
export type ListFacetRulesQuery = z.infer<typeof ListFacetRulesQuerySchema>;
export type UploadImportInput = z.infer<typeof UploadImportSchema>;
export type ListImportsQuery = z.infer<typeof ListImportsQuerySchema>;
export type ListImportRowsQuery = z.infer<typeof ListImportRowsQuerySchema>;
export type CreateImportTemplateInput = z.infer<typeof CreateImportTemplateSchema>;
export type CreateWorkflowDefinitionInput = z.infer<typeof CreateWorkflowDefinitionSchema>;
export type WorkflowDecisionInput = z.infer<typeof WorkflowDecisionSchema>;
export type ListWorkflowTasksQuery = z.infer<typeof ListWorkflowTasksQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type CreateChannelInput = z.infer<typeof CreateChannelSchema>;
export type CreateChannelFieldMappingInput = z.infer<typeof CreateChannelFieldMappingSchema>;
export type PublishRunInput = z.infer<typeof PublishRunSchema>;
export type ListPublishJobsQuery = z.infer<typeof ListPublishJobsQuerySchema>;
export type ListOutboxEventsQuery = z.infer<typeof ListOutboxEventsQuerySchema>;
export type ListDeadLetterEventsQuery = z.infer<typeof ListDeadLetterEventsQuerySchema>;
export type ReplayEventsInput = z.infer<typeof ReplayEventsSchema>;
export type ListAuditQuery = z.infer<typeof ListAuditQuerySchema>;
export type ReportPeriodQuery = z.infer<typeof ReportPeriodQuerySchema>;
export type CreateProductSystemIdInput = z.infer<typeof CreateProductSystemIdSchema>;
export type RegisterSourceRecordInput = z.infer<typeof RegisterSourceRecordSchema>;
export type InboundProductInput = z.infer<typeof InboundProductSchema>;
export type DefineSurvivorshipRuleInput = z.infer<typeof DefineSurvivorshipRuleSchema>;
export type ResolveMatchDecisionInput = z.infer<typeof ResolveMatchDecisionSchema>;
export type ListSourceRecordsQuery = z.infer<typeof ListSourceRecordsQuerySchema>;
