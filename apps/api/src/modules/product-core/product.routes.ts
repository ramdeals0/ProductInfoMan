import type { FastifyInstance } from "fastify";
import {
  CreateProductSchema,
  CreateVariantSchema,
  ListProductsQuerySchema,
  SetAttributesSchema,
  UpdateProductSchema,
} from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, requireRoleGroup } from "../../plugins/rbac.js";
import * as productService from "./product.service.js";

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);

  app.post(
    "/products",
    { preHandler: requireRoleGroup("PRODUCT_WRITE") },
    async (request, reply) => {
    try {
      const body = CreateProductSchema.parse(request.body);
      const product = await productService.createProduct(request.organizationId, body);
      return reply.code(201).send(product);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get(
    "/products",
    { preHandler: requireRoleGroup("READ") },
    async (request, reply) => {
    try {
      const query = ListProductsQuerySchema.parse(request.query);
      const result = await productService.listProducts(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get(
    "/products/:id/tree",
    { preHandler: requireRoleGroup("READ") },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const tree = await productService.getProductTree(id, request.organizationId);
      return reply.send(tree);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get(
    "/products/:id/variants",
    { preHandler: requireRoleGroup("READ") },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const variants = await productService.listVariants(id, request.organizationId, {
        storefrontOnly: request.authUser?.isAnonymous === true,
      });
      return reply.send({ items: variants });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post(
    "/products/:id/variants",
    { preHandler: requireRoleGroup("PRODUCT_WRITE") },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = CreateVariantSchema.parse(request.body);
      const variant = await productService.createVariant(id, request.organizationId, body);
      return reply.code(201).send(variant);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get(
    "/products/:id",
    { preHandler: requireRoleGroup("READ") },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const product = await productService.getProduct(id, request.organizationId, {
        storefrontOnly: request.authUser?.isAnonymous === true,
      });
      return reply.send(product);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.patch(
    "/products/:id",
    { preHandler: requireRoleGroup("PRODUCT_WRITE") },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = UpdateProductSchema.parse(request.body);
      const product = await productService.updateProduct(id, request.organizationId, body);
      return reply.send(product);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.delete(
    "/products/:id",
    { preHandler: requireRoleGroup("PRODUCT_WRITE") },
    async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await productService.deleteProduct(id, request.organizationId);
      return reply.code(204).send();
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.put(
    "/products/:id/attributes",
    { preHandler: requireRoleGroup("PRODUCT_WRITE") },
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
      return sendRouteError(reply, request, e);
    }
  });
}
