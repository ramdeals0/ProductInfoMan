import { prisma } from "@productinfoman/db";

export { AppError, appError } from "./errors.js";
export {
  RBAC_ROLE_CODES,
  ROLE_GROUPS,
  ROLE_SEEDS,
  hasAnyRole,
  primaryLegacyRole,
  type RbacRoleCode,
} from "./rbac.js";
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
