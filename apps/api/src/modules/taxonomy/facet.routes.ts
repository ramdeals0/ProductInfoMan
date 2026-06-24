import type { FastifyInstance } from "fastify";
import {
  CreateFacetRuleSchema,
  FacetRuleWorkflowNotesSchema,
  ListFacetDefinitionsQuerySchema,
  ListFacetRulesQuerySchema,
  UpdateFacetRuleSchema,
} from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveActor, requireActor } from "../../plugins/actor.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import * as facetService from "./facet.service.js";
import * as facetWorkflowService from "./facet-workflow.service.js";

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

function workflowActor(request: { actorUserId?: string }) {
  return { userId: request.actorUserId };
}

export async function facetRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);
  app.addHook("preHandler", resolveActor);

  app.get("/facets/definitions", async (request, reply) => {
    try {
      const query = ListFacetDefinitionsQuerySchema.parse(request.query ?? {});
      const facets = await facetService.listFacetDefinitions(request.organizationId, query);
      return reply.send({ items: facets });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/facets/rules", async (request, reply) => {
    try {
      const query = ListFacetRulesQuerySchema.parse(request.query ?? {});
      const rules = await facetWorkflowService.listFacetRules(request.organizationId, {
        categoryId: query.categoryId,
        facetDefinitionId: query.facetDefinitionId,
        state: query.state,
      });
      return reply.send({ items: rules });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/facets/rules", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.FACET_RULE_WRITE);
      const body = CreateFacetRuleSchema.parse(request.body);
      requireActor(request);
      const rule = await facetWorkflowService.createFacetRule(
        request.organizationId,
        body,
        workflowActor(request),
      );
      return reply.code(201).send(rule);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.patch("/facets/rules/:id", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.FACET_RULE_WRITE);
      const { id } = request.params as { id: string };
      const body = UpdateFacetRuleSchema.parse(request.body);
      requireActor(request);
      const rule = await facetWorkflowService.updateFacetRule(
        id,
        request.organizationId,
        body,
        workflowActor(request),
      );
      return reply.send(rule);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/facets/rules/:id/submit", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.FACET_RULE_WRITE);
      const { id } = request.params as { id: string };
      const body = FacetRuleWorkflowNotesSchema.parse(request.body ?? {});
      requireActor(request);
      const rule = await facetWorkflowService.submitFacetRule(
        id,
        request.organizationId,
        workflowActor(request),
        body.notes,
      );
      return reply.send(rule);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/facets/rules/:id/approve", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.FACET_RULE_APPROVE);
      const { id } = request.params as { id: string };
      const body = FacetRuleWorkflowNotesSchema.parse(request.body ?? {});
      requireActor(request);
      const rule = await facetWorkflowService.approveFacetRule(
        id,
        request.organizationId,
        workflowActor(request),
        body.notes,
      );
      return reply.send(rule);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/facets/rules/:id/reject", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.FACET_RULE_APPROVE);
      const { id } = request.params as { id: string };
      const body = FacetRuleWorkflowNotesSchema.parse(request.body ?? {});
      requireActor(request);
      const rule = await facetWorkflowService.rejectFacetRule(
        id,
        request.organizationId,
        workflowActor(request),
        body.notes,
      );
      return reply.send(rule);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/facets/rules/:id/deprecate", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.FACET_RULE_APPROVE);
      const { id } = request.params as { id: string };
      const body = FacetRuleWorkflowNotesSchema.parse(request.body ?? {});
      requireActor(request);
      const rule = await facetWorkflowService.deprecateFacetRule(
        id,
        request.organizationId,
        workflowActor(request),
        body.notes,
      );
      return reply.send(rule);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/facets/rules/:id/clone", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.FACET_RULE_WRITE);
      const { id } = request.params as { id: string };
      requireActor(request);
      const rule = await facetWorkflowService.cloneFacetRule(
        id,
        request.organizationId,
        workflowActor(request),
      );
      return reply.code(201).send(rule);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
