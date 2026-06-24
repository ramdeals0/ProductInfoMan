import type { FastifyInstance } from "fastify";
import { ListAuditQuerySchema } from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, requireRoleGroup } from "../../plugins/rbac.js";
import * as auditService from "./audit.service.js";

async function listAuditHandler(
  request: { organizationId: string; query?: Record<string, unknown> },
  reply: { send: (payload: unknown) => unknown; code: (status: number) => { send: (payload: unknown) => unknown } },
) {
  try {
    const query = ListAuditQuerySchema.parse(request.query ?? {});
    const result = await auditService.listAuditLogs(request.organizationId, query);
    return reply.send(result);
  } catch (e) {
    return sendRouteError(reply, request, e);
  }
}

export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);
  app.addHook("preHandler", requireRoleGroup("READ"));

  app.get("/audit", listAuditHandler);
  app.get("/audit/logs", listAuditHandler);

  app.get("/audit/security", async (request, reply) => {
    try {
      const query = ListAuditQuerySchema.parse(request.query ?? {});
      const result = await auditService.listSecurityAuditLogs(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/audit/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const log = await auditService.getAuditLog(id, request.organizationId);
      return reply.send(log);
    } catch (e) {
      return sendRouteError(reply, request, e);
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
      return sendRouteError(reply, request, e);
    }
  });
}
