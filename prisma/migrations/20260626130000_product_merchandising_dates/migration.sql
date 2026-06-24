-- Add merchandising copy and storefront availability dates to products.
ALTER TABLE "Product"
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "sellingPoints" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "discontinueDate" TIMESTAMP(3);

CREATE INDEX "Product_organizationId_startDate_idx" ON "Product"("organizationId", "startDate");
CREATE INDEX "Product_organizationId_discontinueDate_idx" ON "Product"("organizationId", "discontinueDate");
