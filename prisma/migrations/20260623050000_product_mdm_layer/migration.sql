-- CreateEnum
CREATE TYPE "SourceRecordStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SurvivorshipRuleType" AS ENUM ('SOURCE_PRIORITY', 'MOST_RECENT', 'MOST_COMPLETE');

-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN "sourceSystem" TEXT;

-- CreateTable
CREATE TABLE "ProductSystemId" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemCode" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSystemId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSourceRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "sourceSystem" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "rawPayloadJson" JSONB NOT NULL,
    "normalizedPayloadJson" JSONB,
    "status" "SourceRecordStatus" NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMatchCandidate" (
    "id" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "candidateProductId" TEXT NOT NULL,
    "matchScore" DECIMAL(5,4) NOT NULL,
    "matchReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurvivorshipRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'product',
    "attributeCode" TEXT NOT NULL,
    "ruleType" "SurvivorshipRuleType" NOT NULL,
    "ruleConfigJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurvivorshipRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSystemId_productId_idx" ON "ProductSystemId"("productId");

-- CreateIndex
CREATE INDEX "ProductSystemId_organizationId_systemCode_idx" ON "ProductSystemId"("organizationId", "systemCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSystemId_organizationId_systemCode_externalKey_key" ON "ProductSystemId"("organizationId", "systemCode", "externalKey");

-- CreateIndex
CREATE INDEX "ProductSourceRecord_organizationId_sourceSystem_status_idx" ON "ProductSourceRecord"("organizationId", "sourceSystem", "status");

-- CreateIndex
CREATE INDEX "ProductSourceRecord_productId_idx" ON "ProductSourceRecord"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSourceRecord_organizationId_sourceSystem_sourceRecordId_key" ON "ProductSourceRecord"("organizationId", "sourceSystem", "sourceRecordId");

-- CreateIndex
CREATE INDEX "ProductMatchCandidate_sourceRecordId_idx" ON "ProductMatchCandidate"("sourceRecordId");

-- CreateIndex
CREATE INDEX "ProductMatchCandidate_candidateProductId_idx" ON "ProductMatchCandidate"("candidateProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SurvivorshipRule_organizationId_code_key" ON "SurvivorshipRule"("organizationId", "code");

-- CreateIndex
CREATE INDEX "SurvivorshipRule_organizationId_entityType_isActive_idx" ON "SurvivorshipRule"("organizationId", "entityType", "isActive");

-- AddForeignKey
ALTER TABLE "ProductSystemId" ADD CONSTRAINT "ProductSystemId_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSystemId" ADD CONSTRAINT "ProductSystemId_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSourceRecord" ADD CONSTRAINT "ProductSourceRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSourceRecord" ADD CONSTRAINT "ProductSourceRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatchCandidate" ADD CONSTRAINT "ProductMatchCandidate_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "ProductSourceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMatchCandidate" ADD CONSTRAINT "ProductMatchCandidate_candidateProductId_fkey" FOREIGN KEY ("candidateProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurvivorshipRule" ADD CONSTRAINT "SurvivorshipRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
