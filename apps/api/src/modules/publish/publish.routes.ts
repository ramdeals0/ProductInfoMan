import type { FastifyInstance } from "fastify";
import {
  CreateChannelFieldMappingSchema,
  CreateChannelSchema,
  ListPublishJobsQuerySchema,
  PublishRunSchema,
} from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import * as publishService from "./publish.service.js";

export async function publishRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);
  app.addHook("preHandler", async (request) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      assertRoles(request, ROLE_GROUPS.PUBLISH_OPS);
    }
  });

  app.post("/channels", async (request, reply) => {
    try {
      const body = CreateChannelSchema.parse(request.body);
      const channel = await publishService.createChannel(request.organizationId, body);
      return reply.code(201).send(channel);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/channels", async (request, reply) => {
    try {
      const channels = await publishService.listChannels(request.organizationId);
      return reply.send({ items: channels });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/channels/:id/mappings", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = CreateChannelFieldMappingSchema.array().parse(request.body);
      const mappings = await publishService.createChannelMappings(id, request.organizationId, body);
      return reply.code(201).send({ items: mappings });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/channels/:id/mappings", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const mappings = await publishService.getChannelMappings(id, request.organizationId);
      return reply.send({ items: mappings });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/channels/:id/preview", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { productId } = (request.query ?? {}) as { productId?: string };
      const preview = await publishService.previewChannel(id, request.organizationId, productId);
      return reply.send(preview);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/publish/dry-run", async (request, reply) => {
    try {
      const body = PublishRunSchema.parse(request.body);
      const job = await publishService.startDryRun(request.organizationId, body);
      return reply.code(202).send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/publish/run", async (request, reply) => {
    try {
      const body = PublishRunSchema.parse(request.body);
      const job = await publishService.startPublishRun(request.organizationId, body);
      return reply.code(202).send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/publish/jobs", async (request, reply) => {
    try {
      const query = ListPublishJobsQuerySchema.parse(request.query ?? {});
      const result = await publishService.listPublishJobs(request.organizationId, query);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/publish/jobs/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await publishService.getPublishJob(id, request.organizationId);
      return reply.send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/publish/jobs/:id/artifact", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { artifact, content } = await publishService.getPublishArtifact(id, request.organizationId);
      reply.header("Content-Type", artifact.fileType === "json" ? "application/json" : "text/csv");
      reply.header("Content-Disposition", `attachment; filename="${artifact.fileName}"`);
      return reply.send(content);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/publish/jobs/:id/retry", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const job = await publishService.retryPublishJob(id, request.organizationId);
      return reply.code(202).send(job);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
