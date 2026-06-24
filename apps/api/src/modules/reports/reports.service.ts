import type {
  CompletenessReportEntity,
  DashboardReportEntity,
  ImportReportEntity,
  OperationsReportEntity,
  PublishReportEntity,
  WorkflowReportEntity,
} from "@productinfoman/domain";
import { prisma } from "@productinfoman/db";
import type { Prisma } from "../../../../generated/prisma/client.js";

export type ReportPeriod = {
  periodStart: Date;
  periodEnd: Date;
};

const DEFAULT_PERIOD_DAYS = 7;

export function resolveReportPeriod(query?: {
  periodStart?: string;
  periodEnd?: string;
}): ReportPeriod {
  const periodEnd = query?.periodEnd ? new Date(query.periodEnd) : new Date();
  const periodStart = query?.periodStart
    ? new Date(query.periodStart)
    : new Date(periodEnd.getTime() - DEFAULT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  return { periodStart, periodEnd };
}

async function ensureMetricDefinitions(organizationId: string): Promise<void> {
  const defaults = [
    {
      code: "product_completeness",
      name: "Product Completeness",
      description: "Fraction of required attributes present per product",
    },
    {
      code: "workflow_throughput",
      name: "Workflow Throughput",
      description: "Products moved to approved or published per day",
    },
    {
      code: "import_success_rate",
      name: "Import Success Rate",
      description: "Valid rows divided by total rows per import job",
    },
    {
      code: "publish_success_rate",
      name: "Publish Success Rate",
      description: "Successful items divided by total items per publish job",
    },
  ];

  for (const metric of defaults) {
    await prisma.metricDefinition.upsert({
      where: { organizationId_code: { organizationId, code: metric.code } },
      create: { organizationId, ...metric },
      update: { name: metric.name, description: metric.description },
    });
  }
}

function isValuePresent(value: Prisma.JsonValue | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export async function computeProductCompletenessScore(
  organizationId: string,
  productId: string,
): Promise<number> {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    include: {
      attributeValues: true,
      primaryCategory: {
        include: {
          attributeSet: {
            include: {
              bindings: {
                where: { requirement: "REQUIRED" },
                include: { attributeDefinition: true },
              },
            },
          },
        },
      },
    },
  });

  return scoreProductCompleteness(product, organizationId);
}

async function scoreProductCompleteness(
  product: {
    id: string;
    organizationId: string;
    attributeValues: Array<{ attributeDefinitionId: string; value: unknown }>;
    primaryCategory: {
      attributeSet: {
        bindings: Array<{ attributeDefinitionId: string }>;
      } | null;
    } | null;
  } | null,
  organizationId: string,
  globalRequiredIds?: string[],
): Promise<number> {
  if (!product) return 0;

  const requiredBindings = product.primaryCategory?.attributeSet?.bindings ?? [];
  const globalRequired =
    globalRequiredIds ??
    (
      await prisma.attributeDefinition.findMany({
        where: { organizationId, isRequired: true },
        select: { id: true },
      })
    ).map((attr) => attr.id);

  const requiredAttrIds = new Set([
    ...requiredBindings.map((binding) => binding.attributeDefinitionId),
    ...globalRequired,
  ]);

  if (requiredAttrIds.size === 0) return 100;

  const valuesByAttrId = new Map(
    product.attributeValues.map((value) => [value.attributeDefinitionId, value.value]),
  );

  let present = 0;
  for (const attrId of requiredAttrIds) {
    if (isValuePresent(valuesByAttrId.get(attrId) as never)) present += 1;
  }

  return Math.round((present / requiredAttrIds.size) * 100);
}

async function computeAverageCompleteness(organizationId: string): Promise<number> {
  const [products, globalRequired] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        attributeValues: true,
        primaryCategory: {
          select: {
            attributeSet: {
              select: {
                bindings: {
                  where: { requirement: "REQUIRED" },
                  select: { attributeDefinitionId: true },
                },
              },
            },
          },
        },
      },
      take: 100,
    }),
    prisma.attributeDefinition.findMany({
      where: { organizationId, isRequired: true },
      select: { id: true },
    }),
  ]);

  if (products.length === 0) return 0;

  const globalRequiredIds = globalRequired.map((attr) => attr.id);
  const scores = await Promise.all(
    products.map((product) =>
      scoreProductCompleteness(product, organizationId, globalRequiredIds),
    ),
  );

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export async function computeDashboard(
  organizationId: string,
  period: ReportPeriod,
): Promise<DashboardReportEntity> {
  await ensureMetricDefinitions(organizationId);

  const [
    productsByStatus,
    importJobs,
    publishJobs,
    averageCompletenessScore,
  ] = await Promise.all([
    prisma.product.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.importJob.findMany({
      where: {
        organizationId,
        createdAt: { gte: period.periodStart, lte: period.periodEnd },
      },
      select: { status: true },
    }),
    prisma.publishJob.findMany({
      where: {
        organizationId,
        createdAt: { gte: period.periodStart, lte: period.periodEnd },
      },
      select: { status: true, totalItems: true, successfulItems: true },
    }),
    computeAverageCompleteness(organizationId),
  ]);

  const productStatus = Object.fromEntries(
    productsByStatus.map((row) => [row.status, row._count._all]),
  );
  const totalProducts = productsByStatus.reduce((sum, row) => sum + row._count._all, 0);
  const approvedProducts =
    (productStatus.APPROVED ?? 0) +
    (productStatus.PUBLISH_READY ?? 0) +
    (productStatus.PUBLISHED ?? 0);
  const publishedProducts = productStatus.PUBLISHED ?? 0;

  const importCompleted = importJobs.filter((job) => job.status === "COMPLETED").length;
  const importFailed = importJobs.filter((job) => job.status === "FAILED").length;
  const publishCompleted = publishJobs.filter((job) => job.status === "COMPLETED").length;
  const publishFailed = publishJobs.filter((job) => job.status === "FAILED").length;

  return {
    generatedAt: new Date().toISOString(),
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    totalProducts,
    approvedProducts,
    publishedProducts,
    averageCompletenessScore,
    imports: {
      totalJobs: importJobs.length,
      completedJobs: importCompleted,
      failedJobs: importFailed,
      successRate:
        importJobs.length > 0 ? Math.round((importCompleted / importJobs.length) * 100) : 0,
    },
    publishing: {
      totalJobs: publishJobs.length,
      completedJobs: publishCompleted,
      failedJobs: publishFailed,
      successRate:
        publishJobs.length > 0 ? Math.round((publishCompleted / publishJobs.length) * 100) : 0,
    },
  };
}

export async function computeCompletenessReport(
  organizationId: string,
  period: ReportPeriod,
): Promise<CompletenessReportEntity> {
  const categories = await prisma.category.findMany({
    where: { organizationId },
    select: { id: true, code: true, name: true },
  });

  const products = await prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      updatedAt: { gte: period.periodStart, lte: period.periodEnd },
    },
    select: {
      id: true,
      organizationId: true,
      primaryCategoryId: true,
      attributeValues: true,
      primaryCategory: {
        select: {
          attributeSet: {
            select: {
              bindings: {
                where: { requirement: "REQUIRED" },
                select: { attributeDefinitionId: true },
              },
            },
          },
        },
      },
    },
  });

  const globalRequired = await prisma.attributeDefinition.findMany({
    where: { organizationId, isRequired: true },
    select: { id: true },
  });
  const globalRequiredIds = globalRequired.map((attr) => attr.id);

  const scores = await Promise.all(
    products.map(async (product) => ({
      categoryId: product.primaryCategoryId,
      score: await scoreProductCompleteness(product, organizationId, globalRequiredIds),
    })),
  );

  const byCategoryMap = new Map<string, { total: number; sum: number }>();
  for (const entry of scores) {
    const key = entry.categoryId ?? "uncategorized";
    const current = byCategoryMap.get(key) ?? { total: 0, sum: 0 };
    current.total += 1;
    current.sum += entry.score;
    byCategoryMap.set(key, current);
  }

  const byCategory = categories
    .map((category) => {
      const stats = byCategoryMap.get(category.id);
      if (!stats) return null;
      return {
        categoryId: category.id,
        categoryCode: category.code,
        categoryName: category.name,
        productCount: stats.total,
        averageScore: Math.round(stats.sum / stats.total),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const globalScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, entry) => sum + entry.score, 0) / scores.length)
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    globalScore,
    totalProducts: products.length,
    byCategory,
  };
}

export async function computeWorkflowReport(
  organizationId: string,
  period: ReportPeriod,
): Promise<WorkflowReportEntity> {
  const history = await prisma.workflowHistory.findMany({
    where: {
      organizationId,
      createdAt: { gte: period.periodStart, lte: period.periodEnd },
    },
    select: { toState: true },
  });

  const transitionsToApproved = history.filter((entry) => entry.toState === "APPROVED").length;
  const transitionsToPublished = history.filter((entry) => entry.toState === "PUBLISHED").length;

  return {
    generatedAt: new Date().toISOString(),
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    transitionsToApproved,
    transitionsToPublished,
    totalTransitions: history.length,
  };
}

export async function computeImportReport(
  organizationId: string,
  period: ReportPeriod,
): Promise<ImportReportEntity> {
  const jobs = await prisma.importJob.findMany({
    where: {
      organizationId,
      createdAt: { gte: period.periodStart, lte: period.periodEnd },
    },
    select: {
      id: true,
      fileName: true,
      status: true,
      totalRows: true,
      validRows: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const completedJobs = jobs.filter((job) => job.status === "COMPLETED").length;
  const failedJobs = jobs.filter((job) => job.status === "FAILED").length;
  const validRates = jobs
    .filter((job) => job.totalRows > 0)
    .map((job) => job.validRows / job.totalRows);

  return {
    generatedAt: new Date().toISOString(),
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    totalJobs: jobs.length,
    completedJobs,
    failedJobs,
    successRate: jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0,
    averageValidRowRate:
      validRates.length > 0
        ? Math.round((validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length) * 100)
        : 0,
    jobs: jobs.map((job) => ({
      importJobId: job.id,
      fileName: job.fileName,
      status: job.status,
      totalRows: job.totalRows,
      validRows: job.validRows,
      successRate: job.totalRows > 0 ? Math.round((job.validRows / job.totalRows) * 100) : 0,
    })),
  };
}

export async function computePublishReport(
  organizationId: string,
  period: ReportPeriod,
): Promise<PublishReportEntity> {
  const jobs = await prisma.publishJob.findMany({
    where: {
      organizationId,
      createdAt: { gte: period.periodStart, lte: period.periodEnd },
    },
    select: {
      id: true,
      channelId: true,
      mode: true,
      status: true,
      totalItems: true,
      successfulItems: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const completedJobs = jobs.filter((job) => job.status === "COMPLETED").length;
  const failedJobs = jobs.filter((job) => job.status === "FAILED").length;
  const itemRates = jobs
    .filter((job) => job.totalItems > 0)
    .map((job) => job.successfulItems / job.totalItems);

  return {
    generatedAt: new Date().toISOString(),
    periodStart: period.periodStart.toISOString(),
    periodEnd: period.periodEnd.toISOString(),
    totalJobs: jobs.length,
    completedJobs,
    failedJobs,
    successRate: jobs.length > 0 ? Math.round((completedJobs / jobs.length) * 100) : 0,
    averageItemSuccessRate:
      itemRates.length > 0
        ? Math.round((itemRates.reduce((sum, rate) => sum + rate, 0) / itemRates.length) * 100)
        : 0,
    jobs: jobs.map((job) => ({
      publishJobId: job.id,
      channelId: job.channelId,
      mode: job.mode,
      status: job.status,
      totalItems: job.totalItems,
      successfulItems: job.successfulItems,
      successRate: job.totalItems > 0 ? Math.round((job.successfulItems / job.totalItems) * 100) : 0,
    })),
  };
}

export async function getOperationsReport(organizationId: string): Promise<OperationsReportEntity> {
  const period = resolveReportPeriod();
  const dashboard = await computeDashboard(organizationId, period);

  const [
    productsByStatus,
    importJobsByStatus,
    publishJobsByStatus,
    workflowTasksByStatus,
    outboxByStatus,
    deadLetterCount,
    categoryCount,
    channelCount,
  ] = await Promise.all([
    prisma.product.groupBy({
      by: ["status"],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.importJob.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.publishJob.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.workflowTask.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.outboxEvent.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.deadLetterEvent.count({ where: { organizationId } }),
    prisma.category.count({ where: { organizationId } }),
    prisma.channel.count({ where: { organizationId, isActive: true } }),
  ]);

  const productStatus = Object.fromEntries(
    productsByStatus.map((row) => [row.status, row._count._all]),
  );

  return {
    generatedAt: dashboard.generatedAt,
    catalog: {
      totalProducts: dashboard.totalProducts,
      approvedProducts: dashboard.approvedProducts,
      completenessPct: dashboard.averageCompletenessScore,
      byStatus: productStatus,
      categoryCount,
    },
    imports: {
      byStatus: Object.fromEntries(
        importJobsByStatus.map((row) => [row.status, row._count._all]),
      ),
      completed: importJobsByStatus.find((row) => row.status === "COMPLETED")?._count._all ?? 0,
      failed: importJobsByStatus.find((row) => row.status === "FAILED")?._count._all ?? 0,
    },
    workflow: {
      byStatus: Object.fromEntries(
        workflowTasksByStatus.map((row) => [row.status, row._count._all]),
      ),
      openTasks: workflowTasksByStatus.find((row) => row.status === "OPEN")?._count._all ?? 0,
      completedTasks:
        workflowTasksByStatus.find((row) => row.status === "COMPLETED")?._count._all ?? 0,
    },
    publishing: {
      byStatus: Object.fromEntries(
        publishJobsByStatus.map((row) => [row.status, row._count._all]),
      ),
      completed: publishJobsByStatus.find((row) => row.status === "COMPLETED")?._count._all ?? 0,
      failed: publishJobsByStatus.find((row) => row.status === "FAILED")?._count._all ?? 0,
      activeChannels: channelCount,
    },
    eventing: {
      byStatus: Object.fromEntries(outboxByStatus.map((row) => [row.status, row._count._all])),
      deadLetterCount,
    },
  };
}
