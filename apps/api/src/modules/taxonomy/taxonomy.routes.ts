import type { FastifyInstance } from "fastify";
import {
  CreateAttributeGroupSchema,
  CreateAttributeSchema,
  CreateCategorySchema,
  CreateFacetDefinitionSchema,
  CreateFacetRuleSchema,
  LinkCategoryAttributeGroupsSchema,
  LinkCategoryAttributesSchema,
  ListFacetDefinitionsQuerySchema,
  ListFacetRulesQuerySchema,
  UpdateAttributeGroupSchema,
  UpdateAttributeSchema,
  UpdateCategorySchema,
  UpdateFacetDefinitionSchema,
} from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import { resolveActor, requireActor } from "../../plugins/actor.js";
import * as facetService from "./facet.service.js";
import * as facetWorkflowService from "./facet-workflow.service.js";
import * as taxonomyService from "./taxonomy.service.js";
import { ZodError } from "zod";

export async function taxonomyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);
  app.addHook("preHandler", resolveActor);
  app.addHook("preHandler", async (request) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      const path = request.url.split("?")[0] ?? "";
      if (path.includes("/facet-rules")) {
        return;
      }
      assertRoles(request, ROLE_GROUPS.TAXONOMY_WRITE);
    }
  });

  app.post("/categories", async (request, reply) => {
    try {
      const body = CreateCategorySchema.parse(request.body);
      const category = await taxonomyService.createCategory(request.organizationId, body);
      return reply.code(201).send(category);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/categories", async (request, reply) => {
    try {
      const categories = await taxonomyService.listCategories(request.organizationId);
      return reply.send({ items: categories });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/categories/tree", async (request, reply) => {
    try {
      const tree = await taxonomyService.getCategoryTree(request.organizationId);
      return reply.send({ items: tree });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.patch("/categories/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = UpdateCategorySchema.parse(request.body);
      const category = await taxonomyService.updateCategory(id, request.organizationId, body);
      return reply.send(category);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/categories/:id/attribute-groups", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const groups = await taxonomyService.listAttributeGroupsForCategory(
        id,
        request.organizationId,
      );
      return reply.send({ items: groups });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/categories/:id/attributes", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const attrs = await taxonomyService.listAttributesForCategory(id, request.organizationId);
      return reply.send({ items: attrs });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/categories/:id/facets", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const facets = await facetService.getCategoryFacets(id, request.organizationId);
      return reply.send({ items: facets });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/categories/:id/attributes", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = LinkCategoryAttributesSchema.parse(request.body);
      const result = await taxonomyService.linkCategoryAttributes(
        id,
        request.organizationId,
        body,
      );
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/categories/:id/attribute-groups", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = LinkCategoryAttributeGroupsSchema.parse(request.body);
      const result = await taxonomyService.linkCategoryAttributeGroups(
        id,
        request.organizationId,
        body,
      );
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/attribute-groups", async (request, reply) => {
    try {
      const body = CreateAttributeGroupSchema.parse(request.body);
      const group = await taxonomyService.createAttributeGroup(request.organizationId, body);
      return reply.code(201).send(group);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/attribute-groups", async (request, reply) => {
    try {
      const groups = await taxonomyService.listAttributeGroups(request.organizationId);
      return reply.send({ items: groups });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/attribute-groups/:id/attributes", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const attrs = await taxonomyService.listAttributesForGroup(id, request.organizationId);
      return reply.send({ items: attrs });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.patch("/attribute-groups/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = UpdateAttributeGroupSchema.parse(request.body);
      const group = await taxonomyService.updateAttributeGroup(id, request.organizationId, body);
      return reply.send(group);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/attributes", async (request, reply) => {
    try {
      const body = CreateAttributeSchema.parse(request.body);
      const attr = await taxonomyService.createAttribute(request.organizationId, body);
      return reply.code(201).send(attr);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/attributes", async (request, reply) => {
    try {
      const attrs = await taxonomyService.listAttributes(request.organizationId);
      return reply.send({ items: attrs });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.patch("/attributes/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = UpdateAttributeSchema.parse(request.body);
      const attr = await taxonomyService.updateAttribute(id, request.organizationId, body);
      return reply.send(attr);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/facet-definitions", async (request, reply) => {
    try {
      const body = CreateFacetDefinitionSchema.parse(request.body);
      const facet = await facetService.createFacetDefinition(request.organizationId, body);
      return reply.code(201).send(facet);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/facet-definitions", async (request, reply) => {
    try {
      const query = ListFacetDefinitionsQuerySchema.parse(request.query ?? {});
      const facets = await facetService.listFacetDefinitions(request.organizationId, query);
      return reply.send({ items: facets });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.patch("/facet-definitions/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = UpdateFacetDefinitionSchema.parse(request.body);
      const facet = await facetService.updateFacetDefinition(id, request.organizationId, body);
      return reply.send(facet);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/facet-rules", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.FACET_RULE_WRITE);
      const body = CreateFacetRuleSchema.parse(request.body);
      requireActor(request);
      const rule = await facetWorkflowService.createFacetRule(
        request.organizationId,
        body,
        { userId: request.actorUserId },
      );
      return reply.code(201).send(rule);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/facet-rules", async (request, reply) => {
    try {
      const query = ListFacetRulesQuerySchema.parse(request.query ?? {});
      const rules = await facetWorkflowService.listFacetRules(request.organizationId, {
        categoryId: query.categoryId,
        facetDefinitionId: query.facetDefinitionId,
        state: query.state,
      });
      return reply.send({ items: rules });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  // ASSUMPTION CHANGE: spec path /facets/categories/:id aliases category facets endpoint.
  app.get("/facets/categories/:categoryId", async (request, reply) => {
    try {
      const { categoryId } = request.params as { categoryId: string };
      const facets = await facetService.getCategoryFacets(categoryId, request.organizationId);
      return reply.send({ items: facets });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
