import { prisma } from "@productinfoman/db";

export { AppError, appError } from "./errors.js";
export {
  GENERIC_HTTP_ERROR_MESSAGE,
  resolveHttpError,
  type ResolvedHttpError,
} from "./http-errors.js";
export {
  RBAC_ROLE_CODES,
  ROLE_GROUPS,
  ROLE_SEEDS,
  hasAnyRole,
  primaryLegacyRole,
  type RbacRoleCode,
} from "./rbac.js";
export {
  CAPABILITIES,
  ROLE_CAPABILITIES,
  ROLE_GROUP_CAPABILITIES,
  hasCapability,
  hasCapabilityGroup,
  listCapabilitiesForRoles,
  type Capability,
} from "./rbac.config.js";
export { recordSecurityEvent, type SecurityAuditParams } from "./security-audit.js";
export {
  writeAudit,
  recordChange,
  recordSnapshot,
  type AuditAction,
  type AuditSource,
  type EntityChangeType,
} from "./audit.js";

export async function detectProductLoop(
  productId: string,
  proposedParentId: string,
): Promise<boolean> {
  let current: string | null = proposedParentId;
  const visited = new Set<string>([productId]);

  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    const parent = await prisma.product.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parent?.parentId ?? null;
  }

  return false;
}
