import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt } from "../../plugins/rbac.js";
import * as authService from "./auth.service.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1).default("demo"),
});

function handleError(error: unknown): { statusCode: number; message: string } {
  if (error && typeof error === "object" && "statusCode" in error) {
    return {
      statusCode: (error as { statusCode: number }).statusCode,
      message: (error as Error).message,
    };
  }
  return { statusCode: 500, message: (error as Error).message ?? "Internal error" };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    try {
      const body = LoginSchema.parse(request.body);
      const profile = await authService.validateUser(body.organizationSlug, body.email, body.password);
      if (!profile) {
        return reply.code(401).send({ error: "Invalid email or password" });
      }
      const result = await authService.loginUser(profile);
      return reply.send(result);
    } catch (error) {
      const { statusCode, message } = handleError(error);
      return reply.code(statusCode).send({ error: message });
    }
  });

  app.get(
    "/auth/me",
    {
      preHandler: [resolveTenant, authenticateJwt],
    },
    async (request, reply) => {
      try {
        if (!request.authUser) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
        const profile = await authService.getUserProfile(request.authUser.sub);
        if (!profile) {
          return reply.code(401).send({ error: "Unauthorized" });
        }
        return reply.send({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          organizationSlug: profile.organizationSlug,
          roles: profile.roles,
          legacyRole: profile.legacyRole,
        });
      } catch (error) {
        const { statusCode, message } = handleError(error);
        return reply.code(statusCode).send({ error: message });
      }
    },
  );
}
