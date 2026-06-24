-- Phase 7: Audit and Reporting schema extensions

-- Extend AuditLog with structured change fields
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'api';
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "beforeJson" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "afterJson" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "changedFieldsJson" JSONB;

CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_actorId_idx" ON "AuditLog"("organizationId", "actorId");

-- Entity change history for versioned snapshots
CREATE TYPE "EntityChangeType" AS ENUM ('SNAPSHOT', 'CREATE', 'UPDATE', 'DELETE');

CREATE TABLE "EntityChangeHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "changeType" "EntityChangeType" NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityChangeHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntityChangeHistory_organizationId_entityType_entityId_versionNumber_key" ON "EntityChangeHistory"("organizationId", "entityType", "entityId", "versionNumber");
CREATE INDEX "EntityChangeHistory_organizationId_entityType_entityId_idx" ON "EntityChangeHistory"("organizationId", "entityType", "entityId");
CREATE INDEX "EntityChangeHistory_organizationId_createdAt_idx" ON "EntityChangeHistory"("organizationId", "createdAt");

ALTER TABLE "EntityChangeHistory" ADD CONSTRAINT "EntityChangeHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Metric definitions and observations
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetricDefinition_organizationId_code_key" ON "MetricDefinition"("organizationId", "code");

ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MetricObservation" (
    "id" TEXT NOT NULL,
    "metricId" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "valueNumeric" DECIMAL(12,4),
    "valueText" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetricObservation_metricId_observedAt_idx" ON "MetricObservation"("metricId", "observedAt");
CREATE INDEX "MetricObservation_entityType_entityId_idx" ON "MetricObservation"("entityType", "entityId");

ALTER TABLE "MetricObservation" ADD CONSTRAINT "MetricObservation_metricId_fkey" FOREIGN KEY ("metricId") REFERENCES "MetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Report snapshots for cached dashboard metrics
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportSnapshot_organizationId_reportType_generatedAt_idx" ON "ReportSnapshot"("organizationId", "reportType", "generatedAt");
CREATE INDEX "ReportSnapshot_organizationId_periodStart_periodEnd_idx" ON "ReportSnapshot"("organizationId", "periodStart", "periodEnd");

ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
