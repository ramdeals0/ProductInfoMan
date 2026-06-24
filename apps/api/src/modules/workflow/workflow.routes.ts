import type { FastifyInstance } from "fastify";
import {
  CreateWorkflowDefinitionSchema,
  ListWorkflowTasksQuerySchema,
  WorkflowDecisionSchema,
  WorkflowRejectSchema,
} from "@productinfoman/validation";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveActor, requireActor } from "../../plugins/actor.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, assertRoles, ROLE_GROUPS } from "../../plugins/rbac.js";
import * as workflowService from "./workflow.service.js";

export async function workflowRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);
  app.addHook("preHandler", resolveActor);

  app.post("/workflow/definitions", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.ADMIN_ONLY);
      const body = CreateWorkflowDefinitionSchema.parse(request.body);
      const definition = await workflowService.createWorkflowDefinition(
        request.organizationId,
        body,
      );
      return reply.code(201).send(definition);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/workflow/definitions", async (request, reply) => {
    try {
      const definitions = await workflowService.listWorkflowDefinitions(request.organizationId);
      return reply.send({ items: definitions });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/products/:id/workflow/submit", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.WORKFLOW_SUBMIT);
      const { id } = request.params as { id: string };
      const body = WorkflowDecisionSchema.parse(request.body ?? {});
      const actor = requireActor(request);
      const result = await workflowService.submitProduct(id, request.organizationId, actor, body);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/products/:id/workflow/approve", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.WORKFLOW_APPROVE);
      const { id } = request.params as { id: string };
      const body = WorkflowDecisionSchema.parse(request.body ?? {});
      const actor = requireActor(request);
      const result = await workflowService.approveProduct(id, request.organizationId, actor, body);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/products/:id/workflow/reject", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.WORKFLOW_APPROVE);
      const { id } = request.params as { id: string };
      const body = WorkflowRejectSchema.parse(request.body);
      const actor = requireActor(request);
      const result = await workflowService.rejectProduct(id, request.organizationId, actor, body);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/products/:id/workflow/publish", async (request, reply) => {
    try {
      assertRoles(request, ROLE_GROUPS.WORKFLOW_APPROVE);
      const { id } = request.params as { id: string };
      const body = WorkflowDecisionSchema.parse(request.body ?? {});
      const actor = requireActor(request);
      const result = await workflowService.publishProduct(id, request.organizationId, actor, body);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/products/:id/workflow/history", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const history = await workflowService.getProductWorkflowHistory(id, request.organizationId);
      return reply.send({ items: history });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/workflow/tasks", async (request, reply) => {
    try {
      const query = ListWorkflowTasksQuerySchema.parse(request.query ?? {});
      const tasks = await workflowService.listWorkflowTasks(request.organizationId, query);
      return reply.send({ items: tasks });
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.get("/workflow/tasks/:id", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const task = await workflowService.getWorkflowTask(id, request.organizationId);
      return reply.send(task);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
