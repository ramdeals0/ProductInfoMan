import type { FastifyInstance } from "fastify";
import { SearchQuerySchema } from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
import * as searchService from "./search.service.js";

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

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);

  app.post("/search/reindex", async (request, reply) => {
    try {
      const run = await searchService.startReindex(request.organizationId);
      return reply.code(202).send(run);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/search/index-product/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await searchService.indexProduct(id, request.organizationId);
      return reply.code(202).send(job);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/search/remove-product/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await searchService.removeProductFromIndex(id, request.organizationId);
      return reply.code(202).send(job);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/search", async (request, reply) => {
    try {
      const query = SearchQuerySchema.parse(request.query ?? {});
      const result = await searchService.searchProducts(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/search/facets", async (request, reply) => {
    try {
      const query = SearchQuerySchema.parse(request.query ?? {});
      const result = await searchService.getSearchFacets(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/search/categories/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const query = SearchQuerySchema.parse(request.query ?? {});
      const result = await searchService.getCategorySearchResults(id, request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/search/debug/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const debug = await searchService.getSearchDebug(id, request.organizationId);
      return reply.send(debug);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
