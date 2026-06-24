import type {
  ChannelEntity,
  ChannelFieldMappingEntity,
  ChannelPreviewEntity,
  ExportArtifactEntity,
  PublishHistoryEntity,
  PublishJobEntity,
  PublishJobItemEntity,
} from "@productinfoman/domain";
import type {
  CreateChannelFieldMappingInput,
  CreateChannelInput,
  ListPublishJobsQuery,
  PublishRunInput,
} from "@productinfoman/validation";
import { createEvent } from "@productinfoman/contracts";
import {
  buildExportRows,
  isPublishableStatus,
  serializeExportCsv,
  serializeExportJson,
  type CanonicalProductRecord,
  type ChannelFieldMappingInput,
  type ChannelValidationRuleInput,
} from "@productinfoman/publish-engine";
import { prisma } from "@productinfoman/db";
import { appError, recordChange, writeAudit } from "@productinfoman/shared";
import type { Prisma } from "../../../../generated/prisma/client.js";
import { emitEvent } from "../../lib/events.js";
import { loadCanonicalProduct, loadPublishableProductIds } from "./publish.projection.js";
import { enqueuePublishJob } from "./publish.queue.js";
import { readArtifact, storeExportArtifact } from "./publish.storage.js";

function toChannelDto(channel: {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: ChannelEntity["type"];
  destinationType: ChannelEntity["destinationType"];
  configJson: Prisma.JsonValue;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ChannelEntity {
  return {
    id: channel.id,
    organizationId: channel.organizationId,
    code: channel.code,
    name: channel.name,
    type: channel.type,
    destinationType: channel.destinationType,
    configJson:
      channel.configJson && typeof channel.configJson === "object" && !Array.isArray(channel.configJson)
        ? (channel.configJson as Record<string, unknown>)
        : null,
    isActive: channel.isActive,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

function toMappingDto(mapping: {
  id: string;
  channelId: string;
  mappingVersionId: string;
  sourceField: string;
  targetField: string;
  transformType: ChannelFieldMappingEntity["transformType"];
  transformConfigJson: Prisma.JsonValue;
  isRequired: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): ChannelFieldMappingEntity {
  return {
    id: mapping.id,
    channelId: mapping.channelId,
    mappingVersionId: mapping.mappingVersionId,
    sourceField: mapping.sourceField,
    targetField: mapping.targetField,
    transformType: mapping.transformType,
    transformConfigJson:
      mapping.transformConfigJson &&
      typeof mapping.transformConfigJson === "object" &&
      !Array.isArray(mapping.transformConfigJson)
        ? (mapping.transformConfigJson as Record<string, unknown>)
        : null,
    isRequired: mapping.isRequired,
    sortOrder: mapping.sortOrder,
    createdAt: mapping.createdAt.toISOString(),
    updatedAt: mapping.updatedAt.toISOString(),
  };
}

function toPublishJobDto(job: {
  id: string;
  organizationId: string;
  channelId: string;
  status: PublishJobEntity["status"];
  mode: PublishJobEntity["mode"];
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  createdById: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PublishJobEntity {
  return {
    id: job.id,
    organizationId: job.organizationId,
    channelId: job.channelId,
    status: job.status,
    mode: job.mode,
    totalItems: job.totalItems,
    successfulItems: job.successfulItems,
    failedItems: job.failedItems,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    errorMessage: job.errorMessage,
    createdById: job.createdById,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function toPublishJobItemDto(item: {
  id: string;
  publishJobId: string;
  productId: string;
  status: PublishJobItemEntity["status"];
  exportedPayload: Prisma.JsonValue;
  errorMessage: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PublishJobItemEntity {
  return {
    id: item.id,
    publishJobId: item.publishJobId,
    productId: item.productId,
    status: item.status,
    exportedPayload:
      item.exportedPayload && typeof item.exportedPayload === "object"
        ? (item.exportedPayload as Record<string, unknown>)
        : null,
    errorMessage: item.errorMessage,
    processedAt: item.processedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toArtifactDto(artifact: {
  id: string;
  publishJobId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  byteSize: number;
  generatedAt: Date;
}): ExportArtifactEntity {
  return {
    id: artifact.id,
    publishJobId: artifact.publishJobId,
    fileName: artifact.fileName,
    filePath: artifact.filePath,
    fileType: artifact.fileType,
    byteSize: artifact.byteSize,
    generatedAt: artifact.generatedAt.toISOString(),
  };
}

async function assertUniqueChannelCode(organizationId: string, code: string): Promise<void> {
  const existing = await prisma.channel.findFirst({
    where: { organizationId, code },
    select: { id: true },
  });
  if (existing) throw appError(`Channel code already exists: ${code}`, 409);
}

async function loadChannel(channelId: string, organizationId: string) {
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, organizationId },
  });
  if (!channel) throw appError("Channel not found", 404);
  return channel;
}

async function getActiveMappingVersion(channelId: string) {
  const version = await prisma.channelMappingVersion.findFirst({
    where: { channelId, isActive: true },
    orderBy: { version: "desc" },
    include: {
      fieldMappings: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!version) throw appError("No active channel mapping version found", 404);
  return version;
}

function toMappingInputs(
  mappings: Array<{
    sourceField: string;
    targetField: string;
    transformType: ChannelFieldMappingInput["transformType"];
    transformConfigJson: Prisma.JsonValue;
    isRequired: boolean;
    sortOrder: number;
  }>,
): ChannelFieldMappingInput[] {
  return mappings.map((mapping) => ({
    sourceField: mapping.sourceField,
    targetField: mapping.targetField,
    transformType: mapping.transformType,
    transformConfig:
      mapping.transformConfigJson &&
      typeof mapping.transformConfigJson === "object" &&
      !Array.isArray(mapping.transformConfigJson)
        ? (mapping.transformConfigJson as Record<string, unknown>)
        : null,
    isRequired: mapping.isRequired,
    sortOrder: mapping.sortOrder,
  }));
}

async function loadValidationRules(
  organizationId: string,
  channelId: string,
): Promise<ChannelValidationRuleInput[]> {
  const rules = await prisma.channelValidationRule.findMany({
    where: { organizationId, channelId, isActive: true },
  });
  return rules.map((rule) => ({
    code: rule.code,
    ruleType: rule.ruleType,
    ruleConfig: rule.ruleConfig as Record<string, unknown>,
  }));
}

async function recordHistory(params: {
  organizationId: string;
  channelId: string;
  publishJobId: string;
  productId?: string;
  action: PublishHistoryEntity["action"];
  status: PublishHistoryEntity["status"];
  details?: Record<string, unknown>;
}) {
  await prisma.publishHistory.create({
    data: {
      organizationId: params.organizationId,
      channelId: params.channelId,
      publishJobId: params.publishJobId,
      productId: params.productId,
      action: params.action,
      status: params.status,
      details: params.details,
    },
  });
}

export async function createChannel(
  organizationId: string,
  input: CreateChannelInput,
): Promise<ChannelEntity> {
  await assertUniqueChannelCode(organizationId, input.code);

  const channel = await prisma.channel.create({
    data: {
      organizationId,
      code: input.code,
      name: input.name,
      type: input.type ?? "ECOMMERCE",
      destinationType: input.destinationType ?? "CSV",
      configJson: input.configJson,
      isActive: input.isActive ?? true,
      mappingVersions: {
        create: {
          version: 1,
          isActive: true,
        },
      },
    },
  });

  await writeAudit({
    organizationId,
    entityType: "Channel",
    entityId: channel.id,
    action: "CREATE",
    changes: { code: channel.code, name: channel.name },
  });

  return toChannelDto(channel);
}

export async function listChannels(organizationId: string): Promise<ChannelEntity[]> {
  const channels = await prisma.channel.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
  return channels.map(toChannelDto);
}

export async function createChannelMappings(
  channelId: string,
  organizationId: string,
  mappings: CreateChannelFieldMappingInput[],
): Promise<ChannelFieldMappingEntity[]> {
  await loadChannel(channelId, organizationId);

  const currentVersion = await prisma.channelMappingVersion.findFirst({
    where: { channelId, isActive: true },
    orderBy: { version: "desc" },
  });

  const nextVersionNumber = (currentVersion?.version ?? 0) + 1;

  if (currentVersion) {
    await prisma.channelMappingVersion.update({
      where: { id: currentVersion.id },
      data: { isActive: false },
    });
  }

  const version = await prisma.channelMappingVersion.create({
    data: {
      channelId,
      version: nextVersionNumber,
      isActive: true,
      fieldMappings: {
        create: mappings.map((mapping, index) => ({
          channelId,
          sourceField: mapping.sourceField,
          targetField: mapping.targetField,
          transformType: mapping.transformType ?? "DIRECT",
          transformConfigJson: mapping.transformConfigJson,
          isRequired: mapping.isRequired ?? false,
          sortOrder: mapping.sortOrder ?? index,
        })),
      },
    },
    include: { fieldMappings: { orderBy: { sortOrder: "asc" } } },
  });

  return version.fieldMappings.map(toMappingDto);
}

export async function getChannelMappings(
  channelId: string,
  organizationId: string,
): Promise<ChannelFieldMappingEntity[]> {
  await loadChannel(channelId, organizationId);
  const version = await getActiveMappingVersion(channelId);
  return version.fieldMappings.map(toMappingDto);
}

async function createPublishJobRecord(params: {
  organizationId: string;
  channelId: string;
  mode: "DRY_RUN" | "LIVE";
  productIds: string[];
  createdById?: string;
}) {
  const job = await prisma.publishJob.create({
    data: {
      organizationId: params.organizationId,
      channelId: params.channelId,
      mode: params.mode,
      status: "QUEUED",
      totalItems: params.productIds.length,
      createdById: params.createdById,
      items: {
        create: params.productIds.map((productId) => ({
          productId,
          status: "PENDING",
        })),
      },
    },
  });

  return job;
}

export async function startDryRun(
  organizationId: string,
  input: PublishRunInput,
  createdById?: string,
): Promise<PublishJobEntity> {
  await loadChannel(input.channelId, organizationId);

  const productIds = input.productIds?.length
    ? input.productIds
    : await loadPublishableProductIds(organizationId);

  const job = await createPublishJobRecord({
    organizationId,
    channelId: input.channelId,
    mode: "DRY_RUN",
    productIds,
    createdById,
  });

  await enqueuePublishJob({
    publishJobId: job.id,
    organizationId,
    channelId: input.channelId,
    mode: "DRY_RUN",
  });

  await emitEvent(
    createEvent("publish.job.requested", organizationId, {
      publishJobId: job.id,
      channelId: input.channelId,
      mode: "DRY_RUN",
    }),
  );

  return toPublishJobDto(job);
}

export async function startPublishRun(
  organizationId: string,
  input: PublishRunInput,
  createdById?: string,
): Promise<PublishJobEntity> {
  const channel = await loadChannel(input.channelId, organizationId);
  if (!channel.isActive) throw appError("Channel is not active", 400);

  const productIds = input.productIds?.length
    ? input.productIds
    : await loadPublishableProductIds(organizationId);

  const job = await createPublishJobRecord({
    organizationId,
    channelId: input.channelId,
    mode: "LIVE",
    productIds,
    createdById,
  });

  await enqueuePublishJob({
    publishJobId: job.id,
    organizationId,
    channelId: input.channelId,
    mode: "LIVE",
  });

  await emitEvent(
    createEvent("publish.job.requested", organizationId, {
      publishJobId: job.id,
      channelId: input.channelId,
      mode: "LIVE",
    }),
  );

  return toPublishJobDto(job);
}

export async function processPublishJob(publishJobId: string, organizationId: string): Promise<void> {
  const job = await prisma.publishJob.findFirst({
    where: { id: publishJobId, organizationId },
    include: {
      channel: true,
      items: true,
    },
  });
  if (!job) throw appError("Publish job not found", 404);

  await prisma.publishJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", startedAt: new Date(), attempts: { increment: 1 } },
  });

  try {
    const mappingVersion = await getActiveMappingVersion(job.channelId);
    const mappingInputs = toMappingInputs(mappingVersion.fieldMappings);
    const validationRules = await loadValidationRules(organizationId, job.channelId);
    const targetFields = mappingInputs.map((mapping) => mapping.targetField);

    const records: CanonicalProductRecord[] = [];
    for (const item of job.items) {
      const record = await loadCanonicalProduct(item.productId, organizationId);
      if (!record) {
        await prisma.publishJobItem.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            errorMessage: "Product not found",
            processedAt: new Date(),
          },
        });
        continue;
      }

      if (!isPublishableStatus(record.status)) {
        await prisma.publishJobItem.update({
          where: { id: item.id },
          data: {
            status: "SKIPPED",
            errorMessage: `Product status ${record.status} is not publishable`,
            processedAt: new Date(),
          },
        });
        await recordHistory({
          organizationId,
          channelId: job.channelId,
          publishJobId: job.id,
          productId: item.productId,
          action: job.mode === "DRY_RUN" ? "DRY_RUN" : "EXPORT",
          status: "SKIPPED",
          details: { reason: "not_publishable", status: record.status },
        });
        continue;
      }

      records.push(record);
    }

    const exportRows = buildExportRows(records, mappingInputs, validationRules);
    const rowByProductId = new Map(exportRows.map((row) => [row.product_id, row]));

    let successfulItems = 0;
    let failedItems = 0;

    for (const item of job.items) {
      const row = rowByProductId.get(item.productId);
      if (!row) continue;

      if (row.errors.length > 0) {
        failedItems += 1;
        await prisma.publishJobItem.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            errorMessage: row.errors.map((error) => error.message).join("; "),
            exportedPayload: row.fields,
            processedAt: new Date(),
          },
        });
        await recordHistory({
          organizationId,
          channelId: job.channelId,
          publishJobId: job.id,
          productId: item.productId,
          action: row.errors.some((error) => error.targetField === "_validation")
            ? "VALIDATION_FAILED"
            : job.mode === "DRY_RUN"
              ? "DRY_RUN"
              : "EXPORT",
          status: "FAILED",
          details: { errors: row.errors },
        });
        continue;
      }

      successfulItems += 1;
      await prisma.publishJobItem.update({
        where: { id: item.id },
        data: {
          status: "EXPORTED",
          exportedPayload: row.fields,
          processedAt: new Date(),
        },
      });
      await recordHistory({
        organizationId,
        channelId: job.channelId,
        publishJobId: job.id,
        productId: item.productId,
        action: job.mode === "DRY_RUN" ? "DRY_RUN" : "EXPORT",
        status: "SUCCESS",
        details: { fields: row.fields },
      });
    }

    const successfulRows = exportRows.filter((row) => row.errors.length === 0);
    const content =
      job.channel.destinationType === "JSON"
        ? serializeExportJson(successfulRows)
        : serializeExportCsv(successfulRows, targetFields);

    const extension = job.channel.destinationType === "JSON" ? "json" : "csv";
    const fileName = `${job.channel.code}-${job.mode.toLowerCase()}-${job.id}.${extension}`;
    const stored = await storeExportArtifact({
      organizationId,
      publishJobId: job.id,
      fileName,
      content,
      fileType: extension,
    });

    await prisma.exportArtifact.create({
      data: {
        publishJobId: job.id,
        fileName: stored.fileName,
        filePath: stored.filePath,
        fileType: extension,
        byteSize: stored.byteSize,
      },
    });

  if (job.mode === "LIVE" && job.channel.destinationType === "HTTP_WEBHOOK") {
      const webhookUrl =
        job.channel.configJson &&
        typeof job.channel.configJson === "object" &&
        !Array.isArray(job.channel.configJson)
          ? (job.channel.configJson as Record<string, unknown>).webhookUrl
          : null;

      if (typeof webhookUrl === "string" && webhookUrl.length > 0) {
        try {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: content,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Webhook delivery failed";
          await prisma.publishJob.update({
            where: { id: job.id },
            data: {
              status: "FAILED",
              failedItems: failedItems + successfulItems,
              successfulItems: 0,
              errorMessage: message,
              completedAt: new Date(),
            },
          });
          throw error;
        }
      }
    }

    const skippedItems = job.items.length - successfulItems - failedItems;
    const finalStatus = failedItems > 0 && successfulItems === 0 ? "FAILED" : "COMPLETED";
    await prisma.publishJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        successfulItems,
        failedItems,
        totalItems: job.items.length,
        errorMessage: failedItems > 0 ? `${failedItems} item(s) failed; ${skippedItems} skipped` : null,
        completedAt: new Date(),
      },
    });

    await emitEvent(
      createEvent("publish.job.completed", organizationId, {
        publishJobId: job.id,
        channelId: job.channelId,
        mode: job.mode,
        successfulItems,
        failedItems,
        status: finalStatus,
      }),
    );

    await recordChange({
      organizationId,
      entityType: "PublishJob",
      entityId: job.id,
      action: "EXPORT",
      source: "publishing",
      after: {
        status: finalStatus,
        successfulItems,
        failedItems,
        totalItems: job.items.length,
        mode: job.mode,
        channelId: job.channelId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish job failed";
    const current = await prisma.publishJob.findUnique({ where: { id: job.id } });
    const shouldRetry = (current?.attempts ?? 0) < (current?.maxAttempts ?? 3);

    await prisma.publishJob.update({
      where: { id: job.id },
      data: {
        status: shouldRetry ? "RETRYING" : "FAILED",
        errorMessage: message,
        completedAt: shouldRetry ? undefined : new Date(),
      },
    });

    if (shouldRetry) throw error;
  }
}

export async function retryPublishJob(
  publishJobId: string,
  organizationId: string,
): Promise<PublishJobEntity> {
  const job = await prisma.publishJob.findFirst({
    where: { id: publishJobId, organizationId },
  });
  if (!job) throw appError("Publish job not found", 404);
  if (job.status !== "FAILED" && job.status !== "RETRYING") {
    throw appError("Only failed jobs can be retried", 400);
  }

  await prisma.publishJob.update({
    where: { id: job.id },
    data: { status: "QUEUED", errorMessage: null, completedAt: null },
  });

  await prisma.publishJobItem.updateMany({
    where: { publishJobId: job.id, status: { in: ["FAILED", "PENDING"] } },
    data: { status: "PENDING", errorMessage: null, processedAt: null },
  });

  await recordHistory({
    organizationId,
    channelId: job.channelId,
    publishJobId: job.id,
    action: "RETRY",
    status: "SUCCESS",
  });

  await enqueuePublishJob({
    publishJobId: job.id,
    organizationId,
    channelId: job.channelId,
    mode: job.mode,
  });

  const updated = await prisma.publishJob.findUniqueOrThrow({ where: { id: job.id } });
  return toPublishJobDto(updated);
}

export async function listPublishJobs(
  organizationId: string,
  query: ListPublishJobsQuery,
): Promise<{ items: PublishJobEntity[]; total: number }> {
  const where = {
    organizationId,
    ...(query.channelId ? { channelId: query.channelId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.publishJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.publishJob.count({ where }),
  ]);

  return {
    items: items.map(toPublishJobDto),
    total,
  };
}

export async function getPublishJob(
  publishJobId: string,
  organizationId: string,
): Promise<PublishJobEntity & { items: PublishJobItemEntity[]; artifacts: ExportArtifactEntity[] }> {
  const job = await prisma.publishJob.findFirst({
    where: { id: publishJobId, organizationId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      artifacts: { orderBy: { generatedAt: "desc" } },
    },
  });
  if (!job) throw appError("Publish job not found", 404);

  return {
    ...toPublishJobDto(job),
    items: job.items.map(toPublishJobItemDto),
    artifacts: job.artifacts.map(toArtifactDto),
  };
}

export async function getPublishArtifact(
  publishJobId: string,
  organizationId: string,
): Promise<{ artifact: ExportArtifactEntity; content: string }> {
  const job = await prisma.publishJob.findFirst({
    where: { id: publishJobId, organizationId },
    include: {
      artifacts: { orderBy: { generatedAt: "desc" }, take: 1 },
    },
  });
  if (!job) throw appError("Publish job not found", 404);
  if (job.artifacts.length === 0) throw appError("No export artifact found for job", 404);

  const artifact = toArtifactDto(job.artifacts[0]);
  const content = await readArtifact(artifact.filePath);
  return { artifact, content };
}

export async function previewChannel(
  channelId: string,
  organizationId: string,
  productId?: string,
): Promise<ChannelPreviewEntity> {
  const channel = await loadChannel(channelId, organizationId);
  const mappingVersion = await getActiveMappingVersion(channelId);
  const mappingInputs = toMappingInputs(mappingVersion.fieldMappings);
  const validationRules = await loadValidationRules(organizationId, channelId);

  const productIds = productId
    ? [productId]
    : (await loadPublishableProductIds(organizationId)).slice(0, 5);

  const previews = [];
  for (const id of productIds) {
    const record = await loadCanonicalProduct(id, organizationId);
    if (!record) continue;
    const [row] = buildExportRows([record], mappingInputs, validationRules);
    previews.push({
      productId: record.product_id,
      sku: record.sku,
      status: record.status,
      isPublishable: isPublishableStatus(record.status),
      fields: row.fields,
      errors: row.errors,
    });
  }

  return {
    channel: toChannelDto(channel),
    mappingVersion: mappingVersion.version,
    previews,
  };
}
