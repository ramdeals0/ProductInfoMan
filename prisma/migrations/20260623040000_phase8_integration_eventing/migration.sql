-- Phase 8: Integration and Eventing schema

CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');
CREATE TYPE "IntegrationEventStatus" AS ENUM ('DISPATCHED', 'DELIVERED', 'FAILED');
CREATE TYPE "EventConsumptionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "IntegrationEndpointType" AS ENUM ('WEBHOOK', 'QUEUE', 'SFTP', 'INTERNAL');
CREATE TYPE "IntegrationRetryStatus" AS ENUM ('SCHEDULED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXHAUSTED');

CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "metadataJson" JSONB,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboxEvent_organizationId_status_idx" ON "OutboxEvent"("organizationId", "status");
CREATE INDEX "OutboxEvent_organizationId_eventType_idx" ON "OutboxEvent"("organizationId", "eventType");
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");
CREATE INDEX "OutboxEvent_occurredAt_idx" ON "OutboxEvent"("occurredAt");

ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "outboxEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'DISPATCHED',
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationEvent_outboxEventId_key" ON "IntegrationEvent"("outboxEventId");
CREATE INDEX "IntegrationEvent_organizationId_eventType_idx" ON "IntegrationEvent"("organizationId", "eventType");
CREATE INDEX "IntegrationEvent_dispatchedAt_idx" ON "IntegrationEvent"("dispatchedAt");

ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventConsumptionLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "consumerName" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "EventConsumptionStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventConsumptionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventConsumptionLog_eventId_consumerName_idempotencyKey_key" ON "EventConsumptionLog"("eventId", "consumerName", "idempotencyKey");
CREATE INDEX "EventConsumptionLog_organizationId_consumerName_status_idx" ON "EventConsumptionLog"("organizationId", "consumerName", "status");
CREATE INDEX "EventConsumptionLog_eventId_idx" ON "EventConsumptionLog"("eventId");

ALTER TABLE "EventConsumptionLog" ADD CONSTRAINT "EventConsumptionLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventConsumptionLog" ADD CONSTRAINT "EventConsumptionLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeadLetterEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "consumerName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "lastError" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeadLetterEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeadLetterEvent_eventId_consumerName_key" ON "DeadLetterEvent"("eventId", "consumerName");
CREATE INDEX "DeadLetterEvent_organizationId_consumerName_idx" ON "DeadLetterEvent"("organizationId", "consumerName");

ALTER TABLE "DeadLetterEvent" ADD CONSTRAINT "DeadLetterEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeadLetterEvent" ADD CONSTRAINT "DeadLetterEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IntegrationEndpoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpointType" "IntegrationEndpointType" NOT NULL DEFAULT 'INTERNAL',
    "configJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationEndpoint_organizationId_code_key" ON "IntegrationEndpoint"("organizationId", "code");
CREATE INDEX "IntegrationEndpoint_organizationId_isActive_idx" ON "IntegrationEndpoint"("organizationId", "isActive");

ALTER TABLE "IntegrationEndpoint" ADD CONSTRAINT "IntegrationEndpoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IntegrationRetry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deadLetterEventId" TEXT NOT NULL,
    "status" "IntegrationRetryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationRetry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationRetry_organizationId_status_idx" ON "IntegrationRetry"("organizationId", "status");
CREATE INDEX "IntegrationRetry_deadLetterEventId_idx" ON "IntegrationRetry"("deadLetterEventId");

ALTER TABLE "IntegrationRetry" ADD CONSTRAINT "IntegrationRetry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationRetry" ADD CONSTRAINT "IntegrationRetry_deadLetterEventId_fkey" FOREIGN KEY ("deadLetterEventId") REFERENCES "DeadLetterEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
