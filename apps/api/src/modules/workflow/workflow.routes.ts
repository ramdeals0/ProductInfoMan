import type { FastifyInstance } from "fastify";
import {
  CreateWorkflowDefinitionSchema,
  ListWorkflowTasksQuerySchema,
  WorkflowDecisionSchema,
  WorkflowRejectSchema,
} from "@productinfoman/validation";
import { AppError } from "@productinfoman/shared";
import { resolveActor, requireActor } from "../../plugins/actor.js";
import { resolveTenant } from "../../plugins/tenant.js";
import * as workflowService from "./workflow.service.js";

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

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", resolveActor);

  app.post("/workflow/definitions", async (request, reply) => {
    try {
      const body = CreateWorkflowDefinitionSchema.parse(request.body);
      const definition = await workflowService.createWorkflowDefinition(
        request.organizationId,
        body,
      );
      return reply.code(201).send(definition);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/workflow/definitions", async (request, reply) => {
    try {
      const definitions = await workflowService.listWorkflowDefinitions(request.organizationId);
      return reply.send({ items: definitions });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/products/:id/workflow/submit", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = WorkflowDecisionSchema.parse(request.body ?? {});
      const actor = requireActor(request);
      const result = await workflowService.submitProduct(id, request.organizationId, actor, body);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/products/:id/workflow/approve", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = WorkflowDecisionSchema.parse(request.body ?? {});
      const actor = requireActor(request);
      const result = await workflowService.approveProduct(id, request.organizationId, actor, body);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/products/:id/workflow/reject", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = WorkflowRejectSchema.parse(request.body);
      const actor = requireActor(request);
      const result = await workflowService.rejectProduct(id, request.organizationId, actor, body);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.post("/products/:id/workflow/publish", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = WorkflowDecisionSchema.parse(request.body ?? {});
      const actor = requireActor(request);
      const result = await workflowService.publishProduct(id, request.organizationId, actor, body);
      return reply.send(result);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/products/:id/workflow/history", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const history = await workflowService.getProductWorkflowHistory(id, request.organizationId);
      return reply.send({ items: history });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/workflow/tasks", async (request, reply) => {
    try {
      const query = ListWorkflowTasksQuerySchema.parse(request.query ?? {});
      const tasks = await workflowService.listWorkflowTasks(request.organizationId, query);
      return reply.send({ items: tasks });
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get("/workflow/tasks/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const task = await workflowService.getWorkflowTask(id, request.organizationId);
      return reply.send(task);
    } catch (e) {
      const { statusCode, message } = handleError(e);
      return reply.code(statusCode).send({ error: message });
    }
  });
}
