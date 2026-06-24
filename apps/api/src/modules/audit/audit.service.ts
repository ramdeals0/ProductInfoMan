import type { AuditLogEntity } from "@productinfoman/domain";
import { prisma } from "@productinfoman/db";
import { appError } from "@productinfoman/shared";
import type { Prisma } from "../../../../generated/prisma/client.js";

export type ListAuditQuery = {
  entityType?: string;
  entityId?: string;
  productId?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  pageSize: number;
};

function toAuditDto(log: {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  productId: string | null;
  action: AuditLogEntity["action"];
  actorId: string | null;
  changes: Prisma.JsonValue;
  correlationId: string | null;
  createdAt: Date;
}): AuditLogEntity {
  return {
    id: log.id,
    organizationId: log.organizationId,
    entityType: log.entityType,
    entityId: log.entityId,
    productId: log.productId,
    action: log.action,
    actorId: log.actorId,
    changes:
      log.changes && typeof log.changes === "object" && !Array.isArray(log.changes)
        ? (log.changes as Record<string, unknown>)
        : null,
    correlationId: log.correlationId,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function listAuditLogs(
  organizationId: string,
  query: ListAuditQuery,
): Promise<{ items: AuditLogEntity[]; total: number }> {
  const where = {
    organizationId,
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.entityId ? { entityId: query.entityId } : {}),
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.action ? { action: query.action as Prisma.EnumAuditActionFilter["equals"] } : {}),
    ...(query.fromDate || query.toDate
      ? {
          createdAt: {
            ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
            ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items: items.map(toAuditDto), total };
}

export async function getAuditLog(id: string, organizationId: string): Promise<AuditLogEntity> {
  const log = await prisma.auditLog.findFirst({
    where: { id, organizationId },
  });
  if (!log) throw appError("Audit log not found", 404);
  return toAuditDto(log);
}
