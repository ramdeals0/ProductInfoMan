import type { FastifyInstance } from "fastify";
import {
  ListDeadLetterEventsQuerySchema,
  ListOutboxEventsQuerySchema,
  ReplayEventsSchema,
} from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import * as integrationService from "./integration.service.js";

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);

  app.get("/events/outbox", async (request, reply) => {
    try {
      const query = ListOutboxEventsQuerySchema.parse(request.query ?? {});
      const result = await integrationService.listOutboxEvents(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/events/dead-letter", async (request, reply) => {
    try {
      const query = ListDeadLetterEventsQuerySchema.parse(request.query ?? {});
      const result = await integrationService.listDeadLetterEvents(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/events/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const event = await integrationService.getOutboxEvent(id, request.organizationId);
      return reply.send(event);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/events/replay", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.EVENT_OPS);
      const body = ReplayEventsSchema.parse(request.body ?? {});
      const result = await integrationService.replayEvents(request.organizationId, body);
      return reply.code(202).send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/events/:id/retry", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.EVENT_OPS);
      const { id } = request.params as { id: string };
      await integrationService.retryEventById(id, request.organizationId);
      const event = await integrationService.getOutboxEvent(id, request.organizationId).catch(() => null);
      return reply.code(202).send({ retried: true, eventId: id, event });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
