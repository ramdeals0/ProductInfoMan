import { prisma } from "@productinfoman/db";
import type { Prisma } from "../../generated/prisma/client.js";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATE_CHANGE"
  | "IMPORT"
  | "EXPORT"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "ACCOUNT_LOCKOUT"
  | "ACCOUNT_UNLOCK"
  | "ROLE_ASSIGNMENT"
  | "LOGOUT"
  | "SECURITY_CONFIG_CHANGE";

export type EntityChangeType = "SNAPSHOT" | "CREATE" | "UPDATE" | "DELETE";

export type AuditSource = "api" | "import" | "workflow" | "publishing" | "mdm";

function computeChangedFields(
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!before || !after) return undefined;

  const changed: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed[key] = { before: before[key], after: after[key] };
    }
  }

  return Object.keys(changed).length > 0 ? changed : undefined;
}

export async function recordChange(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  productId?: string;
  performedBy?: string;
  source?: AuditSource;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changedFields?: Record<string, unknown>;
  correlationId?: string;
  changes?: Record<string, unknown>;
}): Promise<string> {
  const changedFieldsJson =
    params.changedFields ??
    computeChangedFields(params.before, params.after) ??
    params.changes;

  const log = await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      productId: params.productId,
      action: params.action,
      actorId: params.performedBy,
      source: params.source ?? "api",
      beforeJson: params.before as Prisma.InputJsonValue | undefined,
      afterJson: params.after as Prisma.InputJsonValue | undefined,
      changedFieldsJson: changedFieldsJson as Prisma.InputJsonValue | undefined,
      changes: changedFieldsJson as Prisma.InputJsonValue | undefined,
      correlationId: params.correlationId,
    },
  });

  return log.id;
}

export async function recordSnapshot(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  snapshot: Record<string, unknown>;
  changeType: EntityChangeType;
  createdBy?: string;
}): Promise<{ historyId: string; versionNumber: number }> {
  const latest = await prisma.entityChangeHistory.findFirst({
    where: {
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
    },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  const history = await prisma.entityChangeHistory.create({
    data: {
      organizationId: params.organizationId,
      entityType: params.entityType,
      entityId: params.entityId,
      versionNumber,
      changeType: params.changeType,
      snapshotJson: params.snapshot as Prisma.InputJsonValue,
      createdById: params.createdBy,
    },
  });

  return { historyId: history.id, versionNumber };
}

/** @deprecated Use recordChange instead */
export async function writeAudit(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  productId?: string;
  actorId?: string;
  changes?: Record<string, unknown>;
  correlationId?: string;
  source?: AuditSource;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): Promise<string> {
  return recordChange({
    organizationId: params.organizationId,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    productId: params.productId,
    performedBy: params.actorId,
    source: params.source,
    before: params.before,
    after: params.after,
    changes: params.changes,
    correlationId: params.correlationId,
  });
}
