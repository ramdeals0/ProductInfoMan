-- AlterEnum
ALTER TYPE "ImportEntityType" ADD VALUE 'ATTRIBUTE';
ALTER TYPE "ImportEntityType" ADD VALUE 'FACET';

-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN "entityType" "ImportEntityType" NOT NULL DEFAULT 'PRODUCT';
