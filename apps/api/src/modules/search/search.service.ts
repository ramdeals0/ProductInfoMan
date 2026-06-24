import type {
  SearchDebugEntity,
  SearchFacetResultEntity,
  SearchProjectionJobEntity,
  SearchQueryResultEntity,
  SearchReindexRunEntity,
} from "@productinfoman/domain";
import type { SearchQueryInput } from "@productinfoman/search-projection";
import { isIndexableStatus, PRODUCT_SEARCH_INDEX_MAPPING } from "@productinfoman/search-projection";
import { prisma } from "@productinfoman/db";
import { appError } from "@productinfoman/shared";
import {
  buildProductSearchDocument,
  listIndexableProductIds,
  resolveFacetKeys,
} from "./search.projection.js";
import { enqueueSearchJob, processSearchJob } from "./search.queue.js";
import { getSearchStore } from "./search.store.js";

async function recordSyncEvent(params: {
  organizationId: string;
  productId?: string;
  eventType: "INDEX" | "UPDATE" | "REMOVE" | "REINDEX";
  sourceEvent?: string;
  payload?: Record<string, unknown>;
  status?: "PENDING" | "PROCESSED" | "FAILED";
  errorMessage?: string;
}) {
  return prisma.searchSyncEvent.create({
    data: {
      organizationId: params.organizationId,
      productId: params.productId,
      eventType: params.eventType,
      sourceEvent: params.sourceEvent,
      payload: params.payload ?? undefined,
      status: params.status ?? "PENDING",
      errorMessage: params.errorMessage,
      processedAt: params.status === "PROCESSED" ? new Date() : undefined,
    },
  });
}

async function createProjectionJob(params: {
  organizationId: string;
  jobType: string;
  productId?: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.searchProjectionJob.create({
    data: {
      organizationId: params.organizationId,
      jobType: params.jobType,
      productId: params.productId,
      payload: params.payload ?? undefined,
      status: "QUEUED",
    },
  });
}

async function markProjectionJob(
  jobId: string,
  status: "PROCESSING" | "COMPLETED" | "FAILED" | "RETRYING",
  errorMessage?: string,
) {
  const job = await prisma.searchProjectionJob.update({
    where: { id: jobId },
    data: {
      status,
      attempts: { increment: status === "FAILED" || status === "RETRYING" ? 1 : 0 },
      errorMessage: errorMessage ?? null,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });
  return job;
}

async function getActiveIndexVersion(organizationId: string) {
  const version = await prisma.searchIndexVersion.findFirst({
    where: { organizationId, isActive: true },
    orderBy: { version: "desc" },
  });

  if (version) return version;

  const indexName = `products-${organizationId}`.toLowerCase();
  return prisma.searchIndexVersion.create({
    data: {
      organizationId,
      indexName,
      version: 1,
      mappingJson: PRODUCT_SEARCH_INDEX_MAPPING,
      isActive: true,
    },
  });
}

function toProjectionJobDto(job: {
  id: string;
  organizationId: string;
  jobType: string;
  productId: string | null;
  status: SearchProjectionJobEntity["status"];
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): SearchProjectionJobEntity {
  return {
    id: job.id,
    organizationId: job.organizationId,
    jobType: job.jobType,
    productId: job.productId,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

function toReindexRunDto(run: {
  id: string;
  organizationId: string;
  indexVersionId: string | null;
  status: SearchReindexRunEntity["status"];
  totalProducts: number;
  indexedCount: number;
  failedCount: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SearchReindexRunEntity {
  return {
    id: run.id,
    organizationId: run.organizationId,
    indexVersionId: run.indexVersionId,
    status: run.status,
    totalProducts: run.totalProducts,
    indexedCount: run.indexedCount,
    failedCount: run.failedCount,
    errorMessage: run.errorMessage,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function indexProduct(
  productId: string,
  organizationId: string,
  sourceEvent = "manual.index",
): Promise<SearchProjectionJobEntity> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!product) throw appError("Product not found", 404);

  const job = await createProjectionJob({
    organizationId,
    jobType: isIndexableStatus(product.status) ? "INDEX_PRODUCT" : "REMOVE_PRODUCT",
    productId,
    payload: { sourceEvent },
  });

  await recordSyncEvent({
    organizationId,
    productId,
    eventType: isIndexableStatus(product.status) ? "INDEX" : "REMOVE",
    sourceEvent,
    payload: { jobId: job.id },
  });

  await enqueueSearchJob({
    jobId: job.id,
    organizationId,
    jobType: job.jobType,
    productId,
    sourceEvent,
  });

  return toProjectionJobDto(job);
}

export async function removeProductFromIndex(
  productId: string,
  organizationId: string,
  sourceEvent = "manual.remove",
): Promise<SearchProjectionJobEntity> {
  const job = await createProjectionJob({
    organizationId,
    jobType: "REMOVE_PRODUCT",
    productId,
    payload: { sourceEvent },
  });

  await recordSyncEvent({
    organizationId,
    productId,
    eventType: "REMOVE",
    sourceEvent,
    payload: { jobId: job.id },
  });

  await enqueueSearchJob({
    jobId: job.id,
    organizationId,
    jobType: job.jobType,
    productId,
    sourceEvent,
  });

  return toProjectionJobDto(job);
}

export async function startReindex(organizationId: string): Promise<SearchReindexRunEntity> {
  const indexVersion = await getActiveIndexVersion(organizationId);
  const productIds = await listIndexableProductIds(organizationId);

  const run = await prisma.searchReindexRun.create({
    data: {
      organizationId,
      indexVersionId: indexVersion.id,
      status: "QUEUED",
      totalProducts: productIds.length,
    },
  });

  const job = await createProjectionJob({
    organizationId,
    jobType: "REINDEX_ALL",
    payload: { reindexRunId: run.id, productIds },
  });

  await recordSyncEvent({
    organizationId,
    eventType: "REINDEX",
    sourceEvent: "manual.reindex",
    payload: { reindexRunId: run.id, jobId: job.id },
  });

  await enqueueSearchJob({
    jobId: job.id,
    organizationId,
    jobType: "REINDEX_ALL",
    reindexRunId: run.id,
    productIds,
    sourceEvent: "manual.reindex",
  });

  return toReindexRunDto(run);
}

export async function executeIndexProductJob(
  jobId: string,
  organizationId: string,
  productId: string,
  sourceEvent?: string,
): Promise<void> {
  await markProjectionJob(jobId, "PROCESSING");
  const store = await getSearchStore();
  const indexVersion = await getActiveIndexVersion(organizationId);
  await store.ensureIndex(organizationId, indexVersion.indexName);

  try {
    const document = await buildProductSearchDocument(productId, organizationId);
    if (!document) {
      await store.removeDocument(organizationId, productId);
      await markProjectionJob(jobId, "COMPLETED");
      await recordSyncEvent({
        organizationId,
        productId,
        eventType: "REMOVE",
        sourceEvent,
        status: "PROCESSED",
        payload: { reason: "not_indexable" },
      });
      return;
    }

    await store.indexDocument(organizationId, document);
    await markProjectionJob(jobId, "COMPLETED");
    await recordSyncEvent({
      organizationId,
      productId,
      eventType: "UPDATE",
      sourceEvent,
      status: "PROCESSED",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search projection failed";
    const job = await prisma.searchProjectionJob.findUnique({ where: { id: jobId } });
    const shouldRetry = (job?.attempts ?? 0) + 1 < (job?.maxAttempts ?? 3);

    await markProjectionJob(jobId, shouldRetry ? "RETRYING" : "FAILED", message);
    await recordSyncEvent({
      organizationId,
      productId,
      eventType: "UPDATE",
      sourceEvent,
      status: "FAILED",
      errorMessage: message,
    });

    if (shouldRetry) {
      throw error;
    }
  }
}

export async function executeRemoveProductJob(
  jobId: string,
  organizationId: string,
  productId: string,
  sourceEvent?: string,
): Promise<void> {
  await markProjectionJob(jobId, "PROCESSING");
  try {
    await (await getSearchStore()).removeDocument(organizationId, productId);
    await markProjectionJob(jobId, "COMPLETED");
    await recordSyncEvent({
      organizationId,
      productId,
      eventType: "REMOVE",
      sourceEvent,
      status: "PROCESSED",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search remove failed";
    await markProjectionJob(jobId, "FAILED", message);
    await recordSyncEvent({
      organizationId,
      productId,
      eventType: "REMOVE",
      sourceEvent,
      status: "FAILED",
      errorMessage: message,
    });
    throw error;
  }
}

export async function executeReindexJob(
  jobId: string,
  organizationId: string,
  reindexRunId: string,
  productIds: string[],
  sourceEvent?: string,
): Promise<void> {
  await markProjectionJob(jobId, "PROCESSING");
  await prisma.searchReindexRun.update({
    where: { id: reindexRunId },
    data: { status: "PROCESSING", startedAt: new Date() },
  });

  const store = await getSearchStore();
  const indexVersion = await getActiveIndexVersion(organizationId);
  await store.ensureIndex(organizationId, indexVersion.indexName);
  await store.clearOrganization(organizationId);

  let indexedCount = 0;
  let failedCount = 0;
  let lastError: string | undefined;

  for (const productId of productIds) {
    try {
      const document = await buildProductSearchDocument(productId, organizationId);
      if (document) {
        await store.indexDocument(organizationId, document);
        indexedCount += 1;
      }
    } catch (error) {
      failedCount += 1;
      lastError = error instanceof Error ? error.message : "Reindex item failed";
      await recordSyncEvent({
        organizationId,
        productId,
        eventType: "REINDEX",
        sourceEvent,
        status: "FAILED",
        errorMessage: lastError,
      });
    }
  }

  const status = failedCount > 0 && indexedCount === 0 ? "FAILED" : "COMPLETED";
  await prisma.searchReindexRun.update({
    where: { id: reindexRunId },
    data: {
      status,
      indexedCount,
      failedCount,
      errorMessage: lastError,
      completedAt: new Date(),
    },
  });

  await markProjectionJob(jobId, status === "FAILED" ? "FAILED" : "COMPLETED", lastError);
  await recordSyncEvent({
    organizationId,
    eventType: "REINDEX",
    sourceEvent,
    status: status === "FAILED" ? "FAILED" : "PROCESSED",
    payload: { indexedCount, failedCount },
    errorMessage: lastError,
  });

  if (status === "FAILED") {
    throw new Error(lastError ?? "Reindex failed");
  }
}

export async function searchProducts(
  organizationId: string,
  query: SearchQueryInput,
): Promise<SearchQueryResultEntity> {
  const facetKeys = await resolveFacetKeys(organizationId, query.categoryId);
  const result = await (await getSearchStore()).search(organizationId, query, facetKeys);
  return {
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    items: result.items,
    groups: result.groups,
  };
}

export async function getSearchFacets(
  organizationId: string,
  query: SearchQueryInput,
): Promise<SearchFacetResultEntity> {
  const scopedQuery = await withCategoryPathScope(organizationId, query);
  const facetKeys = await resolveFacetKeys(organizationId, scopedQuery.categoryId);
  const result = await (await getSearchStore()).facets(organizationId, scopedQuery, facetKeys);
  return {
    total: result.total,
    facets: result.facets,
  };
}

async function withCategoryPathScope(
  organizationId: string,
  query: SearchQueryInput,
): Promise<SearchQueryInput> {
  if (!query.categoryId || query.categoryPath) return query;

  const category = await prisma.category.findFirst({
    where: { id: query.categoryId, organizationId },
    select: { path: true },
  });
  if (!category) return query;

  const { categoryId: _categoryId, ...rest } = query;
  return { ...rest, categoryPath: category.path };
}

export async function getCategorySearchResults(
  categoryId: string,
  organizationId: string,
  query: SearchQueryInput,
): Promise<SearchQueryResultEntity> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
  });
  if (!category) throw appError("Category not found", 404);

  return searchProducts(organizationId, {
    ...query,
    categoryPath: category.path,
  });
}

export async function getSearchDebug(
  productId: string,
  organizationId: string,
): Promise<SearchDebugEntity> {
  const [product, indexed, projection] = await Promise.all([
    prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
      select: {
        id: true,
        sku: true,
        status: true,
        parentId: true,
        productType: true,
      },
    }),
    (await getSearchStore()).getDocument(organizationId, productId),
    buildProductSearchDocument(productId, organizationId),
  ]);

  if (!product) throw appError("Product not found", 404);

  const recentEvents = await prisma.searchSyncEvent.findMany({
    where: { organizationId, productId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    productId: product.id,
    sku: product.sku,
    status: product.status,
    parentId: product.parentId,
    productType: product.productType,
    isIndexable: isIndexableStatus(product.status),
    indexedDocument: indexed,
    projectedDocument: projection,
    recentSyncEvents: recentEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      status: event.status,
      sourceEvent: event.sourceEvent,
      errorMessage: event.errorMessage,
      createdAt: event.createdAt.toISOString(),
      processedAt: event.processedAt?.toISOString() ?? null,
    })),
  };
}

export async function handleProductChange(
  organizationId: string,
  productId: string,
  sourceEvent: string,
): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!product) {
    await removeProductFromIndex(productId, organizationId, sourceEvent);
    return;
  }

  if (isIndexableStatus(product.status)) {
    await indexProduct(productId, organizationId, sourceEvent);
    return;
  }

  await removeProductFromIndex(productId, organizationId, sourceEvent);
}

export { processSearchJob };
