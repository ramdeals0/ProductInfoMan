import type { FastifyInstance } from "fastify";
import { ListAuditQuerySchema } from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
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

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);

  app.get("/audit", async (request, reply) => {
    try {
      const query = ListAuditQuerySchema.parse(request.query ?? {});
      const result = await auditService.listAuditLogs(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

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
}
