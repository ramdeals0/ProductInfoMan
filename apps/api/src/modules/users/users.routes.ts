import type { FastifyInstance } from "fastify";
import { sendRouteError } from "../../lib/route-errors.js";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt, requireRoleGroup } from "../../plugins/rbac.js";
import { resolveClientIp } from "../../plugins/rate-limit.js";
import * as usersService from "./users.service.js";

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", resolveTenant);
  app.addHook("preHandler", authenticateJwt);
  app.addHook("preHandler", requireRoleGroup("ADMIN_ONLY"));

  app.get("/users", async (request, reply) => {
    try {
      const result = await usersService.listUsers(request.organizationId);
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/users", async (request, reply) => {
    try {
      const body = usersService.CreateUserSchema.parse(request.body);
      const user = await usersService.createUser(
        request.organizationId,
        body,
        request.authUser!.sub,
        resolveClientIp(request),
      );
      return reply.code(201).send(user);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.put("/users/:id/roles", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = usersService.UpdateUserRolesSchema.parse(request.body);
      const user = await usersService.updateUserRoles(
        request.organizationId,
        id,
        body,
        request.authUser!.sub,
        resolveClientIp(request),
      );
      return reply.send(user);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });

  app.post("/users/:id/unlock", async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await usersService.unlockUser(
        request.organizationId,
        id,
        request.authUser!.sub,
        resolveClientIp(request),
      );
      return reply.send(result);
    } catch (e) {
      return sendRouteError(reply, request, e);
    }
  });
}
