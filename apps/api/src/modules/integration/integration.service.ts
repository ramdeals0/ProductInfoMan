import type {
  DeadLetterEventEntity,
  OutboxEventEntity,
  ReplayEventsResultEntity,
} from "@productinfoman/domain";
import type { ReplayEventsInput } from "@productinfoman/validation";
import { prisma } from "@productinfoman/db";
import { appError } from "@productinfoman/shared";
import type { Prisma } from "../../../../generated/prisma/client.js";
import { retryDeadLetterEvent, retryOutboxEvent } from "./integration.dispatcher.js";
import { enqueueEventDispatch } from "./integration.queue.js";

function toOutboxDto(event: {
  id: string;
  organizationId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  payloadJson: Prisma.JsonValue;
  metadataJson: Prisma.JsonValue;
  status: OutboxEventEntity["status"];
  occurredAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
}): OutboxEventEntity {
  return {
    id: event.id,
    organizationId: event.organizationId,
    eventType: event.eventType,
    eventVersion: event.eventVersion,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payloadJson: event.payloadJson as Record<string, unknown>,
    metadataJson:
      event.metadataJson && typeof event.metadataJson === "object" && !Array.isArray(event.metadataJson)
        ? (event.metadataJson as Record<string, unknown>)
        : null,
    status: event.status,
    occurredAt: event.occurredAt.toISOString(),
    publishedAt: event.publishedAt?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

function toDeadLetterDto(event: {
  id: string;
  organizationId: string;
  eventId: string;
  consumerName: string;
  eventType: string;
  payloadJson: Prisma.JsonValue;
  lastError: string;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
}): DeadLetterEventEntity {
  return {
    id: event.id,
    organizationId: event.organizationId,
    eventId: event.eventId,
    consumerName: event.consumerName,
    eventType: event.eventType,
    payloadJson: event.payloadJson as Record<string, unknown>,
    lastError: event.lastError,
    attemptCount: event.attemptCount,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export async function listOutboxEvents(
  organizationId: string,
  query: { eventType?: string; status?: OutboxEventEntity["status"]; page: number; pageSize: number },
): Promise<{ items: OutboxEventEntity[]; total: number }> {
  const where = {
    organizationId,
    ...(query.eventType ? { eventType: query.eventType } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.outboxEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.outboxEvent.count({ where }),
  ]);

  return { items: items.map(toOutboxDto), total };
}

export async function listDeadLetterEvents(
  organizationId: string,
  query: { consumerName?: string; page: number; pageSize: number },
): Promise<{ items: DeadLetterEventEntity[]; total: number }> {
  const where = {
    organizationId,
    ...(query.consumerName ? { consumerName: query.consumerName } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.deadLetterEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.deadLetterEvent.count({ where }),
  ]);

  return { items: items.map(toDeadLetterDto), total };
}

export async function replayEvents(
  organizationId: string,
  input: ReplayEventsInput,
): Promise<ReplayEventsResultEntity> {
  const where = {
    organizationId,
    ...(input.eventType ? { eventType: input.eventType } : {}),
    ...(input.fromDate || input.toDate
      ? {
          occurredAt: {
            ...(input.fromDate ? { gte: new Date(input.fromDate) } : {}),
            ...(input.toDate ? { lte: new Date(input.toDate) } : {}),
          },
        }
      : {}),
  };

  const events = await prisma.outboxEvent.findMany({
    where,
    orderBy: { occurredAt: "asc" },
    take: input.limit ?? 100,
  });

  let replayed = 0;
  for (const event of events) {
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: { status: "PENDING", publishedAt: null },
    });
    await enqueueEventDispatch({ outboxEventId: event.id, organizationId });
    replayed += 1;
  }

  return { replayed, eventIds: events.map((event) => event.id) };
}

export async function retryEventById(eventId: string, organizationId: string): Promise<void> {
  const deadLetter = await prisma.deadLetterEvent.findFirst({
    where: { organizationId, OR: [{ id: eventId }, { eventId }] },
  });

  if (deadLetter) {
    await retryDeadLetterEvent(deadLetter.id, organizationId);
    return;
  }

  await retryOutboxEvent(eventId, organizationId);
}

export async function getOutboxEvent(eventId: string, organizationId: string): Promise<OutboxEventEntity> {
  const event = await prisma.outboxEvent.findFirst({
    where: { id: eventId, organizationId },
  });
  if (!event) throw appError("Outbox event not found", 404);
  return toOutboxDto(event);
}
