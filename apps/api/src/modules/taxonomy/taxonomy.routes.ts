import type { FastifyInstance } from "fastify";
import {
  CreateAttributeGroupSchema,
  CreateAttributeSchema,
  CreateCategorySchema,
  LinkCategoryAttributesSchema,
} from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
import * as taxonomyService from "./taxonomy.service.js";

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

export async function taxonomyRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);

  app.post("/categories", async (request, reply) => {
    try {
      const body = CreateCategorySchema.parse(request.body);
      const category = await taxonomyService.createCategory(request.organizationId, body);
      return reply.code(201).send(category);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/categories", async (request, reply) => {
    try {
      const categories = await taxonomyService.listCategories(request.organizationId);
      return reply.send({ items: categories });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
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
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/attribute-groups", async (request, reply) => {
    try {
      const body = CreateAttributeGroupSchema.parse(request.body);
      const group = await taxonomyService.createAttributeGroup(request.organizationId, body);
      return reply.code(201).send(group);
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
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/attributes", async (request, reply) => {
    try {
      const attrs = await taxonomyService.listAttributes(request.organizationId);
      return reply.send({ items: attrs });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
