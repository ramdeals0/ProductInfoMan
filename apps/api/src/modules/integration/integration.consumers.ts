import type { ConsumerName, DomainEventType } from "@productinfoman/eventing";
import { isPublishableStatus } from "@productinfoman/publish-engine";
import { handleProductChange } from "../search/search.service.js";
import { indexProduct } from "../search/search.service.js";

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

async function searchSyncConsumer(event: ConsumerEvent): Promise<void> {
  switch (event.eventType) {
    case "product.created":
    case "product.updated":
    case "product.variant.created":
    case "product.deleted":
    case "product.attributes_changed":
    case "workflow.state.changed": {
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
}

async function reportingSyncConsumer(event: ConsumerEvent): Promise<void> {
  // MVP reporting consumer is a no-op audit trail hook.
  void event.eventId;
}

async function notificationSyncConsumer(event: ConsumerEvent): Promise<void> {
  // MVP notification consumer is a no-op placeholder for external connectors.
  void event.eventId;
}

const consumerHandlers: Record<ConsumerName, (event: ConsumerEvent) => Promise<void>> = {
  "search-sync": searchSyncConsumer,
  "publish-sync": publishSyncConsumer,
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
