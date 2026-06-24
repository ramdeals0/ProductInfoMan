import type { FastifyInstance } from "fastify";
import {
  CreateProductSchema,
  CreateVariantSchema,
  ListProductsQuerySchema,
  SetAttributesSchema,
  UpdateProductSchema,
} from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, requireRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import * as productService from "./product.service.js";

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

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);

  app.post(
    "/products",
    { preHandler: requireRoles(ROLE_GROUPS.PRODUCT_WRITE) },
    async (request, reply) => {
    try {
      const body = CreateProductSchema.parse(request.body);
      const product = await productService.createProduct(request.organizationId, body);
      return reply.code(201).send(product);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get(
    "/products",
    { preHandler: requireRoles(ROLE_GROUPS.READ) },
    async (request, reply) => {
    try {
      const query = ListProductsQuerySchema.parse(request.query);
      const result = await productService.listProducts(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get(
    "/products/:id/tree",
    { preHandler: requireRoles(ROLE_GROUPS.READ) },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tree = await productService.getProductTree(id, request.organizationId);
      return reply.send(tree);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get(
    "/products/:id/variants",
    { preHandler: requireRoles(ROLE_GROUPS.READ) },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const variants = await productService.listVariants(id, request.organizationId);
      return reply.send({ items: variants });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post(
    "/products/:id/variants",
    { preHandler: requireRoles(ROLE_GROUPS.PRODUCT_WRITE) },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = CreateVariantSchema.parse(request.body);
      const variant = await productService.createVariant(id, request.organizationId, body);
      return reply.code(201).send(variant);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get(
    "/products/:id",
    { preHandler: requireRoles(ROLE_GROUPS.READ) },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await productService.getProduct(id, request.organizationId);
      return reply.send(product);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.patch(
    "/products/:id",
    { preHandler: requireRoles(ROLE_GROUPS.PRODUCT_WRITE) },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = UpdateProductSchema.parse(request.body);
      const product = await productService.updateProduct(id, request.organizationId, body);
      return reply.send(product);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.delete(
    "/products/:id",
    { preHandler: requireRoles(ROLE_GROUPS.PRODUCT_WRITE) },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await productService.deleteProduct(id, request.organizationId);
      return reply.code(204).send();
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.put(
    "/products/:id/attributes",
    { preHandler: requireRoles(ROLE_GROUPS.PRODUCT_WRITE) },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = SetAttributesSchema.parse(request.body);
      const product = await productService.setProductAttributes(
        id,
        request.organizationId,
        body,
      );
      return reply.send(product);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
