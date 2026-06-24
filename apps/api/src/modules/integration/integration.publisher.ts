import type { DomainEvent } from "@productinfoman/contracts";
import {
  resolveAggregate,
  validateEventPayload,
} from "@productinfoman/eventing";
import { prisma } from "@productinfoman/db";
import { enqueueEventDispatch } from "./integration.queue.js";

export async function publishDomainEvent(
  event: DomainEvent,
  options?: {
    aggregateType?: string;
    aggregateId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const validation = validateEventPayload(event.eventType, event.payload);
  if (!validation.valid) {
    throw new Error(`Invalid event payload for ${event.eventType}: ${validation.error}`);
  }

  const aggregate = options?.aggregateType && options?.aggregateId
    ? { aggregateType: options.aggregateType, aggregateId: options.aggregateId }
    : resolveAggregate(event.eventType, validation.payload);

  const metadata = {
    eventId: event.eventId,
    correlationId: event.correlationId,
    causationId: event.causationId,
    actorId: event.actorId,
    ...options?.metadata,
  };

  const outbox = await prisma.outboxEvent.create({
    data: {
      id: event.eventId,
      organizationId: event.organizationId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      aggregateType: aggregate.aggregateType,
      aggregateId: aggregate.aggregateId,
      payloadJson: validation.payload,
      metadataJson: metadata,
      status: "PENDING",
      occurredAt: new Date(event.occurredAt),
    },
  });

  await enqueueEventDispatch({
    outboxEventId: outbox.id,
    organizationId: outbox.organizationId,
  });

  return outbox.id;
}

/** EventPublisher facade for domain services */
export const EventPublisher = {
  publish: publishDomainEvent,
};
