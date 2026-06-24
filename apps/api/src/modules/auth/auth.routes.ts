import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PASSWORD_POLICY_SUMMARY, loadApiEnv } from "@productinfoman/config";
import { resolveTenant } from "../../plugins/tenant.js";
import { authenticateJwt } from "../../plugins/rbac.js";
import { RateLimit, resolveClientIp } from "../../plugins/rate-limit.js";
import * as authService from "./auth.service.js";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1).default("demo"),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function handleError(error: unknown): { statusCode: number; message: string; code?: string } {
  if (error instanceof authService.AuthError) {
    return { statusCode: error.statusCode, message: error.message, code: error.code };
  }
  if (error && typeof error === "object" && "statusCode" in error) {
    return {
      statusCode: (error as { statusCode: number }).statusCode,
      message: (error as Error).message,
    };
  }
  return { statusCode: 500, message: (error as Error).message ?? "Internal error" };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/security-policy", async (_request, reply) => {
    const env = loadApiEnv();
    return reply.send({
      passwordPolicy: PASSWORD_POLICY_SUMMARY,
      accessTokenTtl: env.JWT_ACCESS_EXPIRES_IN,
      refreshTokenTtl: env.JWT_REFRESH_EXPIRES_IN,
      loginMaxAttempts: env.LOGIN_MAX_ATTEMPTS,
      lockoutMinutes: env.LOGIN_LOCKOUT_MINUTES,
      mfaSupported: false,
    });
  });

  app.post(
    "/auth/login",
    { config: RateLimit("login", "ip") },
    async (request, reply) => {
      try {
        const body = LoginSchema.parse(request.body);
        const ipAddress = resolveClientIp(request);
        const profile = await authService.validateUser(
          body.organizationSlug,
          body.email,
          body.password,
          ipAddress,
        );
        const result = await authService.issueAuthTokens(profile, ipAddress);
        return reply.send({
          token: result.accessToken,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          refreshTokenExpiresAt: result.refreshTokenExpiresAt,
          user: result.user,
        });
      } catch (error) {
        const { statusCode, message, code } = handleError(error);
        return reply.code(statusCode).send({ error: message, code });
      }
    },
  );

  app.post("/auth/refresh", async (request, reply) => {
    try {
      const body = RefreshSchema.parse(request.body);
      const ipAddress = resolveClientIp(request);
      const result = await authService.refreshSession(body.refreshToken, ipAddress);
      return reply.send({
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
        user: result.user,
      });
    } catch (error) {
      const { statusCode, message, code } = handleError(error);
      return reply.code(statusCode).send({ error: message, code });
    }
  });

  app.post(
    "/auth/logout",
    { preHandler: [resolveTenant, authenticateJwt] },
    async (request, reply) => {
      try {
        const body = z.object({ refreshToken: z.string().optional() }).parse(request.body ?? {});
        await authService.logoutUser(body.refreshToken, request.authUser?.sub, resolveClientIp(request));
        return reply.send({ ok: true });
      } catch (error) {
        const { statusCode, message } = handleError(error);
        return reply.code(statusCode).send({ error: message });
      }
    },
  );

  app.get(
    "/auth/me",
    { preHandler: [resolveTenant, authenticateJwt] },
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
          mfaEnabled: profile.mfaEnabled,
          mfaType: profile.mfaType,
        });
      } catch (error) {
        const { statusCode, message } = handleError(error);
        return reply.code(statusCode).send({ error: message });
      }
    },
  );
}
