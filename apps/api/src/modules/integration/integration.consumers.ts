import type { ConsumerName, DomainEventType } from "@productinfoman/eventing";
import { isPublishableStatus } from "@productinfoman/publish-engine";
import { prisma } from "@productinfoman/db";
import { recordChange } from "@productinfoman/shared";
import { handleProductChange, indexProduct } from "../search/search.service.js";

type ConsumerEvent = {
  eventId: string;
  eventType: DomainEventType;
  organizationId: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown> | null;
};

function getProductId(payload: Record<string, unknown>): string | undefined {
  return typeof payload.productId === "string" ? payload.productId : undefined;
}

async function hasRecentAudit(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  action: string;
}): Promise<boolean> {
  const recent = await prisma.auditLog.findFirst({
    where: {
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action as never,
      createdAt: { gte: new Date(Date.now() - 10_000) },
    },
    select: { id: true },
  });
  return recent !== null;
}

async function searchSyncConsumer(event: ConsumerEvent): Promise<void> {
  switch (event.eventType) {
    case "product.created":
    case "product.updated":
    case "product.variant.created":
    case "product.deleted":
    case "product.attributes_changed":
    case "workflow.state.changed":
    case "product.mdm.merged":
    case "product.mdm.attribute_overridden": {
      const productId = getProductId(event.payload);
      if (!productId) return;
      await handleProductChange(event.organizationId, productId, event.eventType);
      break;
    }
    case "search.index.requested": {
      const productId = getProductId(event.payload);
      if (!productId) return;
      await indexProduct(productId, event.organizationId, event.eventType);
      break;
    }
    case "taxonomy.facet.updated":
      break;
    default:
      break;
  }
}

async function publishSyncConsumer(event: ConsumerEvent): Promise<void> {
  if (event.eventType === "workflow.state.changed") {
    const toStatus = event.payload.toStatus;
    if (typeof toStatus === "string" && isPublishableStatus(toStatus)) {
      const productId = getProductId(event.payload);
      if (productId) {
        // Publishing is orchestrated via publish.job.requested events from the publish service.
        return;
      }
    }
  }

  if (event.eventType === "publish.job.requested") {
    // Actual publish processing is handled by the publish module queue.
    return;
  }

  if (
    event.eventType === "product.mdm.merged" ||
    event.eventType === "product.mdm.attribute_overridden"
  ) {
    const productId = getProductId(event.payload);
    if (productId) {
      // Publishing is orchestrated via publish.job.requested events from the publish service.
      return;
    }
  }
}

async function auditSyncConsumer(event: ConsumerEvent): Promise<void> {
  const correlationId = event.eventId;

  const existingByCorrelation = await prisma.auditLog.findFirst({
    where: { organizationId: event.organizationId, correlationId },
    select: { id: true },
  });
  if (existingByCorrelation) return;

  switch (event.eventType) {
    case "product.created":
    case "product.updated":
    case "product.variant.created": {
      const productId = getProductId(event.payload);
      if (!productId) return;
      const action = event.eventType === "product.updated" ? "UPDATE" : "CREATE";
      if (await hasRecentAudit({
        organizationId: event.organizationId,
        entityType: "Product",
        entityId: productId,
        action,
      })) {
        return;
      }
      await recordChange({
        organizationId: event.organizationId,
        entityType: "Product",
        entityId: productId,
        productId,
        action,
        source: "eventing",
        after: event.payload,
        correlationId,
      });
      break;
    }
    case "product.deleted": {
      const productId = getProductId(event.payload);
      if (!productId) return;
      if (await hasRecentAudit({
        organizationId: event.organizationId,
        entityType: "Product",
        entityId: productId,
        action: "DELETE",
      })) {
        return;
      }
      await recordChange({
        organizationId: event.organizationId,
        entityType: "Product",
        entityId: productId,
        productId,
        action: "DELETE",
        source: "eventing",
        before: event.payload,
        correlationId,
      });
      break;
    }
    case "workflow.state.changed": {
      const productId = getProductId(event.payload);
      if (!productId) return;
      if (await hasRecentAudit({
        organizationId: event.organizationId,
        entityType: "Product",
        entityId: productId,
        action: "STATE_CHANGE",
      })) {
        return;
      }
      await recordChange({
        organizationId: event.organizationId,
        entityType: "Product",
        entityId: productId,
        productId,
        action: "STATE_CHANGE",
        source: "eventing",
        before: {
          state: event.payload.fromState,
          status: event.payload.fromStatus,
        },
        after: {
          state: event.payload.toState,
          status: event.payload.toStatus,
          actionType: event.payload.actionType,
        },
        correlationId,
      });
      break;
    }
    case "import.job.completed":
    case "import.job.failed": {
      const importJobId = event.payload.importJobId;
      if (typeof importJobId !== "string") return;
      await recordChange({
        organizationId: event.organizationId,
        entityType: "ImportJob",
        entityId: importJobId,
        action: "IMPORT",
        source: "eventing",
        after: event.payload,
        correlationId,
      });
      break;
    }
    case "publish.job.completed":
    case "publish.job.failed": {
      const publishJobId = event.payload.publishJobId;
      if (typeof publishJobId !== "string") return;
      await recordChange({
        organizationId: event.organizationId,
        entityType: "PublishJob",
        entityId: publishJobId,
        action: "EXPORT",
        source: "eventing",
        after: event.payload,
        correlationId,
      });
      break;
    }
    default:
      break;
  }
}

async function reportingSyncConsumer(event: ConsumerEvent): Promise<void> {
  const metricCodeByEvent: Partial<Record<DomainEventType, string>> = {
    "import.job.completed": "import_success_rate",
    "import.job.failed": "import_success_rate",
    "publish.job.completed": "publish_success_rate",
    "publish.job.failed": "publish_success_rate",
    "workflow.state.changed": "workflow_throughput",
  };

  const metricCode = metricCodeByEvent[event.eventType];
  if (!metricCode) return;

  const metric = await prisma.metricDefinition.findFirst({
    where: { organizationId: event.organizationId, code: metricCode },
  });
  if (!metric) return;

  let valueNumeric: number | null = null;
  if (event.eventType === "import.job.completed") {
    const committed = Number(event.payload.committedRows ?? 0);
    const skipped = Number(event.payload.skippedRows ?? 0);
    const total = committed + skipped;
    valueNumeric = total > 0 ? committed / total : 0;
  } else if (event.eventType === "publish.job.completed") {
    const successful = Number(event.payload.successfulItems ?? 0);
    const failed = Number(event.payload.failedItems ?? 0);
    const total = successful + failed;
    valueNumeric = total > 0 ? successful / total : 0;
  } else if (event.eventType === "workflow.state.changed") {
    const toState = event.payload.toState;
    valueNumeric = toState === "APPROVED" || toState === "PUBLISHED" ? 1 : 0;
  } else if (event.eventType.endsWith(".failed")) {
    valueNumeric = 0;
  }

  await prisma.metricObservation.create({
    data: {
      metricId: metric.id,
      entityType: event.eventType.split(".")[0],
      entityId:
        typeof event.payload.importJobId === "string"
          ? event.payload.importJobId
          : typeof event.payload.publishJobId === "string"
            ? event.payload.publishJobId
            : typeof event.payload.productId === "string"
              ? event.payload.productId
              : null,
      valueNumeric,
      valueText: event.eventType,
    },
  });
}

async function notificationSyncConsumer(event: ConsumerEvent): Promise<void> {
  // MVP notification consumer is a no-op placeholder for external connectors.
  void event.eventId;
}

const consumerHandlers: Record<ConsumerName, (event: ConsumerEvent) => Promise<void>> = {
  "search-sync": searchSyncConsumer,
  "publish-sync": publishSyncConsumer,
  "audit-sync": auditSyncConsumer,
  "reporting-sync": reportingSyncConsumer,
  "notification-sync": notificationSyncConsumer,
};

export async function runConsumer(consumerName: ConsumerName, event: ConsumerEvent): Promise<void> {
  const handler = consumerHandlers[consumerName];
  if (!handler) {
    throw new Error(`Unknown consumer: ${consumerName}`);
  }
  await handler(event);
}
