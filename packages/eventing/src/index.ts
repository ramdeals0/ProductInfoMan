import { z } from "zod";

export const DOMAIN_EVENT_VERSION = 1 as const;

export const DOMAIN_EVENT_TYPES = [
  "product.created",
  "product.updated",
  "product.variant.created",
  "product.deleted",
  "product.attributes_changed",
  "taxonomy.category.created",
  "taxonomy.facet.updated",
  "import.job.completed",
  "import.job.failed",
  "workflow.state.changed",
  "workflow.approval.recorded",
  "search.index.requested",
  "publish.job.requested",
  "publish.job.completed",
  "publish.job.failed",
  "audit.record.created",
  "product.mdm.matched",
  "product.mdm.merged",
  "product.mdm.attribute_overridden",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export const ProductCreatedEventSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  productType: z.string(),
  status: z.string(),
});

export const ProductUpdatedEventSchema = z.object({
  productId: z.string(),
  changedFields: z.array(z.string()),
});

export const ProductVariantCreatedEventSchema = z.object({
  productId: z.string(),
  parentId: z.string(),
  sku: z.string(),
  status: z.string(),
});

export const ProductDeletedEventSchema = z.object({
  productId: z.string(),
});

export const ProductAttributesChangedEventSchema = z.object({
  productId: z.string(),
  attributeKeys: z.array(z.string()),
});

export const TaxonomyCategoryCreatedEventSchema = z.object({
  categoryId: z.string(),
  code: z.string(),
  name: z.string(),
  path: z.string(),
});

export const TaxonomyFacetUpdatedEventSchema = z.object({
  facetDefinitionId: z.string(),
  key: z.string(),
  categoryId: z.string().nullable(),
});

export const ImportJobCompletedEventSchema = z.object({
  importJobId: z.string(),
  committedRows: z.number(),
  skippedRows: z.number(),
  status: z.string(),
});

export const ImportJobFailedEventSchema = z.object({
  importJobId: z.string(),
  status: z.string(),
  errorMessage: z.string().optional(),
});

export const PublishJobFailedEventSchema = z.object({
  publishJobId: z.string(),
  channelId: z.string(),
  mode: z.enum(["DRY_RUN", "LIVE"]),
  errorMessage: z.string().optional(),
  status: z.string(),
});

export const WorkflowStateChangedEventSchema = z.object({
  productId: z.string(),
  fromState: z.string(),
  toState: z.string(),
  fromStatus: z.string(),
  toStatus: z.string(),
  actionType: z.string(),
});

export const WorkflowApprovalRecordedEventSchema = z.object({
  productId: z.string(),
  workflowTaskId: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  approverUserId: z.string(),
});

export const SearchIndexRequestedEventSchema = z.object({
  productId: z.string(),
  sourceEvent: z.string(),
});

export const PublishJobRequestedEventSchema = z.object({
  publishJobId: z.string(),
  channelId: z.string(),
  mode: z.enum(["DRY_RUN", "LIVE"]),
});

export const PublishJobCompletedEventSchema = z.object({
  publishJobId: z.string(),
  channelId: z.string(),
  mode: z.enum(["DRY_RUN", "LIVE"]),
  successfulItems: z.number(),
  failedItems: z.number(),
  status: z.string(),
});

export const AuditRecordCreatedEventSchema = z.object({
  auditLogId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  productId: z.string().nullable().optional(),
});

export const ProductMdmMatchedEventSchema = z.object({
  productId: z.string(),
  sourceRecordId: z.string(),
  sourceSystem: z.string(),
});

export const ProductMdmMergedEventSchema = z.object({
  productId: z.string(),
  sourceRecordId: z.string(),
  changedFields: z.array(z.string()),
});

export const ProductMdmAttributeOverriddenEventSchema = z.object({
  productId: z.string(),
  attributeCode: z.string(),
  sourceRecordId: z.string(),
  sourceSystem: z.string(),
});

export const EVENT_SCHEMAS: Record<DomainEventType, z.ZodType<Record<string, unknown>>> = {
  "product.created": ProductCreatedEventSchema,
  "product.updated": ProductUpdatedEventSchema,
  "product.variant.created": ProductVariantCreatedEventSchema,
  "product.deleted": ProductDeletedEventSchema,
  "product.attributes_changed": ProductAttributesChangedEventSchema,
  "taxonomy.category.created": TaxonomyCategoryCreatedEventSchema,
  "taxonomy.facet.updated": TaxonomyFacetUpdatedEventSchema,
  "import.job.completed": ImportJobCompletedEventSchema,
  "import.job.failed": ImportJobFailedEventSchema,
  "workflow.state.changed": WorkflowStateChangedEventSchema,
  "workflow.approval.recorded": WorkflowApprovalRecordedEventSchema,
  "search.index.requested": SearchIndexRequestedEventSchema,
  "publish.job.requested": PublishJobRequestedEventSchema,
  "publish.job.completed": PublishJobCompletedEventSchema,
  "publish.job.failed": PublishJobFailedEventSchema,
  "audit.record.created": AuditRecordCreatedEventSchema,
  "product.mdm.matched": ProductMdmMatchedEventSchema,
  "product.mdm.merged": ProductMdmMergedEventSchema,
  "product.mdm.attribute_overridden": ProductMdmAttributeOverriddenEventSchema,
};

export const CONSUMER_NAMES = [
  "search-sync",
  "publish-sync",
  "audit-sync",
  "reporting-sync",
  "notification-sync",
] as const;

export type ConsumerName = (typeof CONSUMER_NAMES)[number];

export const EVENT_CONSUMER_ROUTING: Record<DomainEventType, ConsumerName[]> = {
  "product.created": ["search-sync", "audit-sync", "reporting-sync"],
  "product.updated": ["search-sync", "audit-sync", "reporting-sync"],
  "product.variant.created": ["search-sync", "audit-sync", "reporting-sync"],
  "product.deleted": ["search-sync", "audit-sync", "reporting-sync"],
  "product.attributes_changed": ["search-sync", "audit-sync"],
  "taxonomy.category.created": ["audit-sync", "reporting-sync"],
  "taxonomy.facet.updated": ["search-sync", "reporting-sync"],
  "import.job.completed": ["audit-sync", "reporting-sync", "notification-sync"],
  "import.job.failed": ["audit-sync", "reporting-sync", "notification-sync"],
  "workflow.state.changed": ["search-sync", "publish-sync", "audit-sync", "notification-sync"],
  "workflow.approval.recorded": ["audit-sync", "reporting-sync", "notification-sync"],
  "search.index.requested": ["search-sync"],
  "publish.job.requested": ["publish-sync"],
  "publish.job.completed": ["audit-sync", "reporting-sync", "notification-sync"],
  "publish.job.failed": ["audit-sync", "reporting-sync", "notification-sync"],
  "audit.record.created": ["reporting-sync"],
  "product.mdm.matched": ["audit-sync", "reporting-sync"],
  "product.mdm.merged": ["search-sync", "publish-sync", "audit-sync", "reporting-sync"],
  "product.mdm.attribute_overridden": ["search-sync", "publish-sync", "audit-sync"],
};

export function isDomainEventType(value: string): value is DomainEventType {
  return (DOMAIN_EVENT_TYPES as readonly string[]).includes(value);
}

export function validateEventPayload(
  eventType: string,
  payload: unknown,
): { valid: true; payload: Record<string, unknown> } | { valid: false; error: string } {
  if (!isDomainEventType(eventType)) {
    return { valid: false, error: `Unknown event type: ${eventType}` };
  }

  const schema = EVENT_SCHEMAS[eventType];
  const result = schema.safeParse(payload);
  if (!result.success) {
    return { valid: false, error: result.error.message };
  }

  return { valid: true, payload: result.data };
}

export function buildIdempotencyKey(eventId: string, consumerName: string): string {
  return `${eventId}:${consumerName}`;
}

export function resolveAggregate(
  eventType: string,
  payload: Record<string, unknown>,
): { aggregateType: string; aggregateId: string } {
  if (eventType.startsWith("product.")) {
    return { aggregateType: "Product", aggregateId: String(payload.productId ?? payload.parentId ?? "unknown") };
  }
  if (eventType.startsWith("taxonomy.category.")) {
    return { aggregateType: "Category", aggregateId: String(payload.categoryId ?? "unknown") };
  }
  if (eventType.startsWith("taxonomy.facet.")) {
    return { aggregateType: "FacetDefinition", aggregateId: String(payload.facetDefinitionId ?? "unknown") };
  }
  if (eventType.startsWith("import.")) {
    return { aggregateType: "ImportJob", aggregateId: String(payload.importJobId ?? "unknown") };
  }
  if (eventType.startsWith("workflow.")) {
    return { aggregateType: "Product", aggregateId: String(payload.productId ?? "unknown") };
  }
  if (eventType.startsWith("search.")) {
    return { aggregateType: "Product", aggregateId: String(payload.productId ?? "unknown") };
  }
  if (eventType.startsWith("publish.")) {
    return { aggregateType: "PublishJob", aggregateId: String(payload.publishJobId ?? "unknown") };
  }
  if (eventType.startsWith("audit.")) {
    return { aggregateType: "AuditLog", aggregateId: String(payload.auditLogId ?? "unknown") };
  }
  if (eventType.startsWith("product.mdm.")) {
    return { aggregateType: "Product", aggregateId: String(payload.productId ?? "unknown") };
  }
  return { aggregateType: "Unknown", aggregateId: "unknown" };
}

export interface QueueAdapter {
  enqueue(jobName: string, payload: Record<string, unknown>, options?: { jobId?: string }): Promise<void>;
}

export interface EventConsumer {
  name: ConsumerName;
  handle(event: {
    eventId: string;
    eventType: DomainEventType;
    organizationId: string;
    payload: Record<string, unknown>;
    metadata?: Record<string, unknown> | null;
  }): Promise<void>;
}

export function getConsumersForEventType(eventType: string): ConsumerName[] {
  if (!isDomainEventType(eventType)) return [];
  return EVENT_CONSUMER_ROUTING[eventType];
}

/** Alias for publishDomainEvent in API layer */
export type DomainEventInput = {
  eventId: string;
  organizationId: string;
  eventType: DomainEventType;
  eventVersion: number;
  payload: Record<string, unknown>;
  occurredAt: string;
  correlationId?: string;
  causationId?: string;
  actorId?: string;
};

export function createValidatedEventPayload(
  eventType: DomainEventType,
  payload: unknown,
): Record<string, unknown> {
  const validation = validateEventPayload(eventType, payload);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return validation.payload;
}
