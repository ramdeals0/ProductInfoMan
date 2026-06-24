import type { FastifyInstance } from "fastify";
import { SearchQuerySchema } from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import * as searchService from "./search.service.js";

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);
  app.addHook("preHandler", async (request) => {
    if (request.method === "POST") {
      assertRoles(request, ROLE_GROUPS.SEARCH_OPS);
    }
  });

  app.post("/search/reindex", async (request, reply) => {
    try {
      const run = await searchService.startReindex(request.organizationId);
      return reply.code(202).send(run);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/search/index-product/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await searchService.indexProduct(id, request.organizationId);
      return reply.code(202).send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/search/remove-product/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await searchService.removeProductFromIndex(id, request.organizationId);
      return reply.code(202).send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/search", async (request, reply) => {
    try {
      const query = SearchQuerySchema.parse(request.query ?? {});
      const result = await searchService.searchProducts(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/search/facets", async (request, reply) => {
    try {
      const query = SearchQuerySchema.parse(request.query ?? {});
      const result = await searchService.getSearchFacets(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/search/categories/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const query = SearchQuerySchema.parse(request.query ?? {});
      const result = await searchService.getCategorySearchResults(id, request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/search/debug/:id", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.SEARCH_OPS);
      const { id } = request.params as { id: string };
      const debug = await searchService.getSearchDebug(id, request.organizationId);
      return reply.send(debug);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
