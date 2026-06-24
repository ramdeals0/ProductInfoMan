import type { FastifyInstance } from "fastify";
import {
  CreateProductSystemIdSchema,
  DefineSurvivorshipRuleSchema,
  InboundProductSchema,
  ListSourceRecordsQuerySchema,
  ResolveMatchDecisionSchema,
} from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoles, requireRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import * as mdmService from "./mdm.service.js";

export async function mdmRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);

  app.get("/mdm/products/:id/systems", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const items = await mdmService.listProductSystemIds(id, request.organizationId);
      return reply.send({ items });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post(
    "/mdm/products/:id/systems",
    { preHandler: requireRoles(ROLE_GROUPS.MDM_WRITE) },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = CreateProductSystemIdSchema.parse(request.body);
      const item = await mdmService.upsertProductSystemId(id, request.organizationId, body);
      return reply.code(201).send(item);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  },
  );

  app.get("/mdm/source-records", async (request, reply) => {
    try {
      const query = ListSourceRecordsQuerySchema.parse(request.query);
      const result = await mdmService.listSourceRecords(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/mdm/source-records/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const record = await mdmService.getSourceRecord(id, request.organizationId);
      return reply.send(record);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/mdm/source-records/:id/match", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.MDM_WRITE);
      const { id } = request.params as { id: string };
      const body = ResolveMatchDecisionSchema.parse(request.body);
      const record = await mdmService.resolveMatchDecision(id, request.organizationId, body);
      return reply.send(record);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/mdm/survivorship-rules", async (request, reply) => {
    try {
      const items = await mdmService.listSurvivorshipRules(request.organizationId);
      return reply.send({ items });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/mdm/survivorship-rules", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.MDM_WRITE);
      const body = DefineSurvivorshipRuleSchema.parse(request.body);
      const item = await mdmService.createSurvivorshipRule(request.organizationId, body);
      return reply.code(201).send(item);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/mdm/products/inbound", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.IMPORT_OPS);
      const body = InboundProductSchema.parse(request.body);
      const result = await mdmService.processInboundProduct(request.organizationId, body);
      return reply.code(202).send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
