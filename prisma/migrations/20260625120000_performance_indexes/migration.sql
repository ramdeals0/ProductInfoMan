-- Performance indexes for product listing, publish job queries, and attribute filters

CREATE INDEX IF NOT EXISTS "Product_organizationId_updatedAt_idx"
  ON "Product"("organizationId", "updatedAt");

CREATE INDEX IF NOT EXISTS "Product_organizationId_status_updatedAt_idx"
  ON "Product"("organizationId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "Product_organizationId_primaryCategoryId_idx"
  ON "Product"("organizationId", "primaryCategoryId");

CREATE INDEX IF NOT EXISTS "PublishJob_channelId_status_createdAt_idx"
  ON "PublishJob"("channelId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ProductAttributeValue_productId_idx"
  ON "ProductAttributeValue"("productId");
