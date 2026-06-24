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

export type FacetRuleWorkflowState = "draft" | "in_review" | "approved" | "deprecated";

export const FACET_RULE_WORKFLOW_STATES: readonly FacetRuleWorkflowState[] = [
  "draft",
  "in_review",
  "approved",
  "deprecated",
] as const;
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
  summary: string | null;
  sellingPoints: string[];
  brand: string | null;
  primaryCategoryId: string | null;
  startDate: string | null;
  discontinueDate: string | null;
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
  facetKey?: string;
  facetLabel?: string;
  ruleType: FacetRuleType;
  ruleConfig: Record<string, unknown> | null;
  priority: number;
  workflowStateCode: FacetRuleWorkflowState;
  createdBy: string | null;
  updatedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
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

export type ImportJobStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "VALIDATION_FAILED"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
export type ImportType = "CREATE" | "UPDATE" | "UPSERT";
export type ImportFileType = "CSV" | "XML" | "JSON";
export type ImportEntityType = "PRODUCT" | "VARIANT" | "CATEGORY";
export type DuplicatePolicy = "REJECT" | "UPDATE" | "SKIP";
export type BlankCellPolicy = "IGNORE" | "CLEAR";

export interface ImportTemplateMappingEntity {
  id: string;
  sourceColumn: string;
  targetField: string;
  transform: string | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface ImportTemplateEntity {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  entityType: ImportEntityType;
  sourceFormat: string;
  configJson: Record<string, unknown> | null;
  isDefault: boolean;
  mappings: ImportTemplateMappingEntity[];
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobEntity {
  id: string;
  organizationId: string;
  importTemplateId: string | null;
  fileName: string;
  filePath: string;
  fileType: ImportFileType;
  importType: ImportType;
  status: ImportJobStatus;
  duplicatePolicy: DuplicatePolicy;
  blankCellPolicy: BlankCellPolicy;
  sourceSystem: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  createdById: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobErrorEntity {
  id: string;
  importJobId: string;
  rowNumber: number;
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  rawValue: string | null;
}

export interface ImportJobRowEntity {
  id: string;
  importJobId: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown> | null;
  status: "PENDING" | "VALID" | "INVALID" | "COMMITTED" | "SKIPPED";
  entityId: string | null;
}

export interface ImportRunSummaryEntity {
  id: string;
  importJobId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  skippedRows: number;
  duplicateRows: number;
  summaryJson: Record<string, unknown> | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowEntityType = "PRODUCT" | "CATEGORY";
export type WorkflowTaskStatus = "OPEN" | "COMPLETED" | "CANCELLED";
export type ApprovalDecision = "APPROVED" | "REJECTED";
export type WorkflowActionType = "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH" | "RESUBMIT";

export interface WorkflowStateEntity {
  id: string;
  code: string;
  name: string;
  productStatus: ProductStatus;
  isInitial: boolean;
  isTerminal: boolean;
  sortOrder: number;
}

export interface WorkflowTransitionEntity {
  id: string;
  fromStateCode: string;
  toStateCode: string;
  actionType: string;
  allowedRoles: string[];
  requiresApproval: boolean;
  requiresJustification: boolean;
  isActive: boolean;
}

export interface WorkflowAssignmentRuleEntity {
  id: string;
  name: string;
  assignToRole: string;
  productTypes: string[] | null;
  categoryCodes: string[] | null;
  priority: number;
  isActive: boolean;
}

export interface WorkflowDefinitionEntity {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  entityType: WorkflowEntityType;
  isActive: boolean;
  states: WorkflowStateEntity[];
  transitions: WorkflowTransitionEntity[];
  assignmentRules: WorkflowAssignmentRuleEntity[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowApprovalEntity {
  id: string;
  approverUserId: string;
  approverEmail: string;
  approverName: string;
  decision: ApprovalDecision;
  decisionReason: string | null;
  comments: string | null;
  decidedAt: string;
}

export interface WorkflowTaskEntity {
  id: string;
  organizationId: string;
  workflowDefinitionId: string;
  workflowStateCode: string;
  entityType: WorkflowEntityType;
  entityId: string;
  productId: string | null;
  productSku: string | null;
  productTitle: string | null;
  productStatus: ProductStatus | null;
  assignedRole: string | null;
  assignedUserId: string | null;
  status: WorkflowTaskStatus;
  actionType: string | null;
  approvals: WorkflowApprovalEntity[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface WorkflowHistoryEntity {
  id: string;
  organizationId: string;
  entityId: string;
  entityType: WorkflowEntityType;
  productId: string | null;
  fromState: string;
  toState: string;
  actionType: string;
  performedById: string | null;
  performedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface WorkflowTransitionResult {
  productId: string;
  sku: string;
  fromState: string;
  toState: string;
  status: ProductStatus;
}

export type SearchProjectionJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING";

export type SearchSyncEventType = "INDEX" | "UPDATE" | "REMOVE" | "REINDEX";
export type SearchSyncEventStatus = "PENDING" | "PROCESSED" | "FAILED";
export type SearchReindexStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface SearchProjectionJobEntity {
  id: string;
  organizationId: string;
  jobType: string;
  productId: string | null;
  status: SearchProjectionJobStatus;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface SearchReindexRunEntity {
  id: string;
  organizationId: string;
  indexVersionId: string | null;
  status: SearchReindexStatus;
  totalProducts: number;
  indexedCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHitEntity {
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

export interface SearchQueryResultEntity {
  total: number;
  page: number;
  pageSize: number;
  items: SearchHitEntity[];
  groups?: Array<{ group_key: string; items: SearchHitEntity[] }>;
}

export interface SearchFacetBucketEntity {
  value: string;
  count: number;
}

export interface SearchFacetAggregationEntity {
  key: string;
  buckets: SearchFacetBucketEntity[];
}

export interface SearchFacetResultEntity {
  total: number;
  facets: SearchFacetAggregationEntity[];
}

export interface SearchSyncEventEntity {
  id: string;
  eventType: SearchSyncEventType;
  status: SearchSyncEventStatus;
  sourceEvent: string | null;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface SearchDebugEntity {
  productId: string;
  sku: string;
  status: ProductStatus;
  parentId: string | null;
  productType: ProductType;
  isIndexable: boolean;
  indexedDocument: Record<string, unknown> | null;
  projectedDocument: Record<string, unknown> | null;
  recentSyncEvents: SearchSyncEventEntity[];
}

export type ChannelType = "ECOMMERCE" | "MARKETPLACE" | "B2B" | "CUSTOM";
export type ChannelDestinationType = "CSV" | "JSON" | "HTTP_WEBHOOK" | "SFTP";
export type ChannelTransformType = "DIRECT" | "TEMPLATE" | "CONCAT" | "LOOKUP" | "DEFAULT";
export type PublishJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "RETRYING";
export type PublishJobMode = "DRY_RUN" | "LIVE";
export type PublishJobItemStatus = "PENDING" | "EXPORTED" | "FAILED" | "SKIPPED";
export type PublishHistoryAction = "DRY_RUN" | "EXPORT" | "RETRY" | "VALIDATION_FAILED";
export type PublishHistoryStatus = "SUCCESS" | "FAILED" | "SKIPPED";

export interface ChannelEntity {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: ChannelType;
  destinationType: ChannelDestinationType;
  configJson: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelFieldMappingEntity {
  id: string;
  channelId: string;
  mappingVersionId: string;
  sourceField: string;
  targetField: string;
  transformType: ChannelTransformType;
  transformConfigJson: Record<string, unknown> | null;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublishJobEntity {
  id: string;
  organizationId: string;
  channelId: string;
  status: PublishJobStatus;
  mode: PublishJobMode;
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdById: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishJobItemEntity {
  id: string;
  publishJobId: string;
  productId: string;
  status: PublishJobItemStatus;
  exportedPayload: Record<string, unknown> | null;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportArtifactEntity {
  id: string;
  publishJobId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  byteSize: number;
  generatedAt: string;
}

export interface PublishHistoryEntity {
  id: string;
  organizationId: string;
  channelId: string;
  publishJobId: string;
  productId: string | null;
  action: PublishHistoryAction;
  status: PublishHistoryStatus;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface ChannelPreviewEntity {
  channel: ChannelEntity;
  mappingVersion: number;
  previews: Array<{
    productId: string;
    sku: string;
    status: ProductStatus;
    isPublishable: boolean;
    fields: Record<string, string>;
    errors: Array<{ targetField: string; message: string }>;
  }>;
}

export type OutboxEventStatus = "PENDING" | "PUBLISHED" | "FAILED";

export interface OutboxEventEntity {
  id: string;
  organizationId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payloadJson: Record<string, unknown>;
  metadataJson: Record<string, unknown> | null;
  status: OutboxEventStatus;
  occurredAt: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface DeadLetterEventEntity {
  id: string;
  organizationId: string;
  eventId: string;
  consumerName: string;
  eventType: string;
  payloadJson: Record<string, unknown>;
  lastError: string;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReplayEventsResultEntity {
  replayed: number;
  eventIds: string[];
}

export interface IntegrationEndpointEntity {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  endpointType: "WEBHOOK" | "QUEUE" | "SFTP" | "INTERNAL";
  configJson: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATE_CHANGE"
  | "IMPORT"
  | "EXPORT";

export interface AuditLogEntity {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  productId: string | null;
  action: AuditAction;
  actorId: string | null;
  source: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  correlationId: string | null;
  createdAt: string;
}

export type EntityChangeType = "SNAPSHOT" | "CREATE" | "UPDATE" | "DELETE";

export interface EntityChangeHistoryEntity {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  changeType: EntityChangeType;
  snapshot: Record<string, unknown>;
  createdById: string | null;
  createdAt: string;
}

export interface DashboardReportEntity {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  totalProducts: number;
  approvedProducts: number;
  publishedProducts: number;
  averageCompletenessScore: number;
  imports: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
  };
  publishing: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    successRate: number;
  };
}

export interface CompletenessReportEntity {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  globalScore: number;
  totalProducts: number;
  byCategory: Array<{
    categoryId: string;
    categoryCode: string;
    categoryName: string;
    productCount: number;
    averageScore: number;
  }>;
}

export interface WorkflowReportEntity {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  transitionsToApproved: number;
  transitionsToPublished: number;
  totalTransitions: number;
}

export interface ImportReportEntity {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  successRate: number;
  averageValidRowRate: number;
  jobs: Array<{
    importJobId: string;
    fileName: string;
    status: string;
    totalRows: number;
    validRows: number;
    successRate: number;
  }>;
}

export interface PublishReportEntity {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  successRate: number;
  averageItemSuccessRate: number;
  jobs: Array<{
    publishJobId: string;
    channelId: string;
    mode: string;
    status: string;
    totalItems: number;
    successfulItems: number;
    successRate: number;
  }>;
}

export interface OperationsReportEntity {
  generatedAt: string;
  catalog: {
    totalProducts: number;
    approvedProducts: number;
    completenessPct: number;
    byStatus: Record<string, number>;
    categoryCount: number;
  };
  imports: {
    byStatus: Record<string, number>;
    completed: number;
    failed: number;
  };
  workflow: {
    byStatus: Record<string, number>;
    openTasks: number;
    completedTasks: number;
  };
  publishing: {
    byStatus: Record<string, number>;
    completed: number;
    failed: number;
    activeChannels: number;
  };
  eventing: {
    byStatus: Record<string, number>;
    deadLetterCount: number;
  };
}

// ─── Product MDM ────────────────────────────────────────────────────────────

export type SourceRecordStatus = "UNMATCHED" | "MATCHED" | "REJECTED";
export type SurvivorshipRuleType = "SOURCE_PRIORITY" | "MOST_RECENT" | "MOST_COMPLETE";
export type MatchDecisionAction = "link" | "ignore" | "create_new_product";

export interface ProductSystemIdEntity {
  id: string;
  organizationId: string;
  productId: string;
  systemCode: string;
  externalKey: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSourceRecordEntity {
  id: string;
  organizationId: string;
  productId: string | null;
  sourceSystem: string;
  sourceRecordId: string;
  rawPayloadJson: Record<string, unknown>;
  normalizedPayloadJson: Record<string, unknown> | null;
  status: SourceRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMatchCandidateEntity {
  id: string;
  sourceRecordId: string;
  candidateProductId: string;
  matchScore: number;
  matchReason: string;
  createdAt: string;
}

export interface SurvivorshipRuleEntity {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  entityType: string;
  attributeCode: string;
  ruleType: SurvivorshipRuleType;
  ruleConfigJson: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSourceRecordDetailEntity extends ProductSourceRecordEntity {
  matchCandidates: ProductMatchCandidateEntity[];
}

export { isStorefrontVisible, type StorefrontAvailabilityInput } from "./storefront.js";
