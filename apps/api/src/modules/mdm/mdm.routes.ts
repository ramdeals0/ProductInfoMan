import type { FastifyInstance } from "fastify";
import {
  CreateProductSystemIdSchema,
  DefineSurvivorshipRuleSchema,
  InboundProductSchema,
  ListSourceRecordsQuerySchema,
  ResolveMatchDecisionSchema,
} from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
import * as mdmService from "./mdm.service.js";

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

export async function mdmRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);

  app.get("/mdm/products/:id/systems", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const items = await mdmService.listProductSystemIds(id, request.organizationId);
      return reply.send({ items });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/mdm/products/:id/systems", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = CreateProductSystemIdSchema.parse(request.body);
      const item = await mdmService.upsertProductSystemId(id, request.organizationId, body);
      return reply.code(201).send(item);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/mdm/source-records", async (request, reply) => {
    try {
      const query = ListSourceRecordsQuerySchema.parse(request.query);
      const result = await mdmService.listSourceRecords(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/mdm/source-records/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const record = await mdmService.getSourceRecord(id, request.organizationId);
      return reply.send(record);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/mdm/source-records/:id/match", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = ResolveMatchDecisionSchema.parse(request.body);
      const record = await mdmService.resolveMatchDecision(id, request.organizationId, body);
      return reply.send(record);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/mdm/survivorship-rules", async (request, reply) => {
    try {
      const items = await mdmService.listSurvivorshipRules(request.organizationId);
      return reply.send({ items });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/mdm/survivorship-rules", async (request, reply) => {
    try {
      const body = DefineSurvivorshipRuleSchema.parse(request.body);
      const item = await mdmService.createSurvivorshipRule(request.organizationId, body);
      return reply.code(201).send(item);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/mdm/products/inbound", async (request, reply) => {
    try {
      const body = InboundProductSchema.parse(request.body);
      const result = await mdmService.processInboundProduct(request.organizationId, body);
      return reply.code(202).send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
