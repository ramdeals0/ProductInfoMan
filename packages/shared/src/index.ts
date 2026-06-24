import { prisma } from "@productinfoman/db";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function appError(message: string, statusCode: number): AppError {
  return new AppError(message, statusCode);
}

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "STATE_CHANGE" | "IMPORT" | "EXPORT";

export async function writeAudit(params: {
  organizationId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  productId?: string;
  actorId?: string;
  changes?: Record<string, unknown>;
  correlationId?: string;
}): Promise<string> {
  const log = await prisma.auditLog.create({ data: params });
  return log.id;
}

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
