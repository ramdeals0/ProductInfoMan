-- CreateEnum
CREATE TYPE "ImportFileType" AS ENUM ('CSV', 'XML', 'JSON');

-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN "fileType" "ImportFileType" NOT NULL DEFAULT 'CSV';
