import type { OperationsReportEntity } from "@productinfoman/domain";
import { prisma } from "@productinfoman/db";

export async function getOperationsReport(organizationId: string): Promise<OperationsReportEntity> {
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
  const totalProducts = productsByStatus.reduce((sum, row) => sum + row._count._all, 0);
  const approvedProducts =
    (productStatus.APPROVED ?? 0) +
    (productStatus.PUBLISH_READY ?? 0) +
    (productStatus.PUBLISHED ?? 0);

  return {
    generatedAt: new Date().toISOString(),
    catalog: {
      totalProducts,
      approvedProducts,
      completenessPct: totalProducts > 0 ? Math.round((approvedProducts / totalProducts) * 100) : 0,
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
