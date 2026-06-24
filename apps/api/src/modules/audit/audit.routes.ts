import type { FastifyInstance } from "fastify";
import { ListAuditQuerySchema } from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt } from "../../plugins/rbac.js";
import * as auditService from "./audit.service.js";

function handleError(error: unknown): { statusCode: number; message: string } {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  if (error && typeof error === "object" && "statusCode" in error) {
    return {
      statusCode: (error as { statusCode: number }).statusCode,
      message: (error as Error).message,
    };
  }
  return { statusCode: 500, message: (error as Error).message ?? "Internal error" };
}

async function listAuditHandler(
  request: { organizationId: string; query?: Record<string, unknown> },
  reply: { send: (payload: unknown) => unknown; code: (status: number) => { send: (payload: unknown) => unknown } },
) {
  try {
    const query = ListAuditQuerySchema.parse(request.query ?? {});
    const result = await auditService.listAuditLogs(request.organizationId, query);
    return reply.send(result);
  } catch (e) {
    const { statusCode, message } = handleError(e);
    return reply.code(statusCode).send({ error: message });
  }
}

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);

  app.get("/audit", listAuditHandler);
  app.get("/audit/logs", listAuditHandler);

  app.get("/audit/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const log = await auditService.getAuditLog(id, request.organizationId);
      return reply.send(log);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/entities/:entityType/:entityId/history", async (request, reply) => {
    try {
      const { entityType, entityId } = request.params as {
        entityType: string;
        entityId: string;
      };
      const history = await auditService.getEntityChangeHistory(
        request.organizationId,
        entityType,
        entityId,
      );
      return reply.send({ items: history });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
