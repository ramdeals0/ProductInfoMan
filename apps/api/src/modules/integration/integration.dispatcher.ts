import {
  buildIdempotencyKey,
  getConsumersForEventType,
  type ConsumerName,
  type DomainEventType,
} from "@productinfoman/eventing";
import { prisma } from "@productinfoman/db";
import { runConsumer } from "./integration.consumers.js";

const MAX_CONSUMER_ATTEMPTS = 3;

export async function dispatchOutboxEvent(outboxEventId: string, organizationId: string): Promise<void> {
  const outbox = await prisma.outboxEvent.findFirst({
    where: { id: outboxEventId, organizationId },
  });
  if (!outbox) throw new Error(`Outbox event not found: ${outboxEventId}`);

  if (outbox.status === "PUBLISHED") {
    return;
  }

  await prisma.outboxEvent.update({
    where: { id: outbox.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await prisma.integrationEvent.upsert({
    where: { outboxEventId: outbox.id },
    create: {
      organizationId: outbox.organizationId,
      outboxEventId: outbox.id,
      eventType: outbox.eventType,
      eventVersion: outbox.eventVersion,
      payloadJson: outbox.payloadJson as object,
      status: "DISPATCHED",
    },
    update: {
      status: "DISPATCHED",
      dispatchedAt: new Date(),
    },
  });

  const consumers = getConsumersForEventType(outbox.eventType);
  for (const consumerName of consumers) {
    try {
      await processConsumerWithIdempotency({
        organizationId: outbox.organizationId,
        eventId: outbox.id,
        eventType: outbox.eventType as DomainEventType,
        consumerName,
        payload: outbox.payloadJson as Record<string, unknown>,
        metadata: outbox.metadataJson as Record<string, unknown> | null,
      });
    } catch (error) {
      console.error(`Consumer ${consumerName} failed for event ${outbox.id}`, error);
    }
  }

  await prisma.integrationEvent.update({
    where: { outboxEventId: outbox.id },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
}

async function processConsumerWithIdempotency(params: {
  organizationId: string;
  eventId: string;
  eventType: DomainEventType;
  consumerName: ConsumerName;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}): Promise<void> {
  const idempotencyKey = buildIdempotencyKey(params.eventId, params.consumerName);

  const existing = await prisma.eventConsumptionLog.findUnique({
    where: {
      eventId_consumerName_idempotencyKey: {
        eventId: params.eventId,
        consumerName: params.consumerName,
        idempotencyKey,
      },
    },
  });

  if (existing?.status === "COMPLETED" || existing?.status === "SKIPPED") {
    return;
  }

  const log = existing
    ? await prisma.eventConsumptionLog.update({
        where: { id: existing.id },
        data: {
          status: "PROCESSING",
          attemptCount: { increment: 1 },
        },
      })
    : await prisma.eventConsumptionLog.create({
        data: {
          organizationId: params.organizationId,
          eventId: params.eventId,
          consumerName: params.consumerName,
          idempotencyKey,
          status: "PROCESSING",
          attemptCount: 1,
        },
      });

  try {
    await runConsumer(params.consumerName, {
      eventId: params.eventId,
      eventType: params.eventType,
      organizationId: params.organizationId,
      payload: params.payload,
      metadata: params.metadata,
    });

    await prisma.eventConsumptionLog.update({
      where: { id: log.id },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
        lastError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Consumer processing failed";
    const attemptCount = log.attemptCount;

    await prisma.eventConsumptionLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        lastError: message,
      },
    });

    if (attemptCount >= MAX_CONSUMER_ATTEMPTS) {
      const deadLetter = await prisma.deadLetterEvent.upsert({
        where: {
          eventId_consumerName: {
            eventId: params.eventId,
            consumerName: params.consumerName,
          },
        },
        create: {
          organizationId: params.organizationId,
          eventId: params.eventId,
          consumerName: params.consumerName,
          eventType: params.eventType,
          payloadJson: params.payload,
          lastError: message,
          attemptCount,
        },
        update: {
          lastError: message,
          attemptCount,
        },
      });

      await prisma.integrationRetry.create({
        data: {
          organizationId: params.organizationId,
          deadLetterEventId: deadLetter.id,
          status: "SCHEDULED",
          scheduledAt: new Date(),
        },
      });
    }

    throw error;
  }
}

export async function retryDeadLetterEvent(deadLetterEventId: string, organizationId: string): Promise<void> {
  const deadLetter = await prisma.deadLetterEvent.findFirst({
    where: { id: deadLetterEventId, organizationId },
  });
  if (!deadLetter) throw new Error("Dead letter event not found");

  const outbox = await prisma.outboxEvent.findFirst({
    where: { id: deadLetter.eventId, organizationId },
  });
  if (!outbox) throw new Error("Source outbox event not found");

  await prisma.eventConsumptionLog.deleteMany({
    where: {
      eventId: deadLetter.eventId,
      consumerName: deadLetter.consumerName,
    },
  });

  await processConsumerWithIdempotency({
    organizationId,
    eventId: outbox.id,
    eventType: outbox.eventType as DomainEventType,
    consumerName: deadLetter.consumerName as ConsumerName,
    payload: outbox.payloadJson as Record<string, unknown>,
    metadata: outbox.metadataJson as Record<string, unknown> | null,
  });

  await prisma.deadLetterEvent.delete({ where: { id: deadLetter.id } });
}

export async function retryOutboxEvent(outboxEventId: string, organizationId: string): Promise<void> {
  const outbox = await prisma.outboxEvent.findFirst({
    where: { id: outboxEventId, organizationId },
  });
  if (!outbox) throw new Error("Outbox event not found");

  await prisma.outboxEvent.update({
    where: { id: outbox.id },
    data: { status: "PENDING", publishedAt: null },
  });

  await dispatchOutboxEvent(outbox.id, organizationId);
}
