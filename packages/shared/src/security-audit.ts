import { prisma } from "@productinfoman/db";
import type { Prisma } from "../../generated/prisma/client.js";
import type { AuditAction } from "./audit.js";

export type SecurityAuditParams = {
  organizationId: string;
  userId: string;
  action: Extract<
    AuditAction,
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILURE"
    | "ACCOUNT_LOCKOUT"
    | "ACCOUNT_UNLOCK"
    | "ROLE_ASSIGNMENT"
    | "LOGOUT"
    | "SECURITY_CONFIG_CHANGE"
  >;
  performedBy?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
};

export async function recordSecurityEvent(params: SecurityAuditParams): Promise<string> {
  const metadata = {
    ...(params.metadata ?? {}),
    ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
  };

  const log = await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      entityType: "user",
      entityId: params.userId,
      action: params.action,
      actorId: params.performedBy ?? params.userId,
      source: "security",
      afterJson: metadata as Prisma.InputJsonValue,
      changedFieldsJson: metadata as Prisma.InputJsonValue,
    },
  });

  return log.id;
}
