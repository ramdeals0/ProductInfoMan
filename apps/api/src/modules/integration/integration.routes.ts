import type { FastifyInstance } from "fastify";
import {
  ListDeadLetterEventsQuerySchema,
  ListOutboxEventsQuerySchema,
  ReplayEventsSchema,
} from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
import * as integrationService from "./integration.service.js";

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

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);

  app.get("/events/outbox", async (request, reply) => {
    try {
      const query = ListOutboxEventsQuerySchema.parse(request.query ?? {});
      const result = await integrationService.listOutboxEvents(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/events/dead-letter", async (request, reply) => {
    try {
      const query = ListDeadLetterEventsQuerySchema.parse(request.query ?? {});
      const result = await integrationService.listDeadLetterEvents(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/events/replay", async (request, reply) => {
    try {
      const body = ReplayEventsSchema.parse(request.body ?? {});
      const result = await integrationService.replayEvents(request.organizationId, body);
      return reply.code(202).send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/events/:id/retry", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await integrationService.retryEventById(id, request.organizationId);
      const event = await integrationService.getOutboxEvent(id, request.organizationId).catch(() => null);
      return reply.code(202).send({ retried: true, eventId: id, event });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
