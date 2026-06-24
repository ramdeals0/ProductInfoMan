import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import {
  rateLimitPolicies,
  type RateLimitPolicy,
  type RateLimitPolicyKey,
} from "../modules/rate-limit/rate-limit.config.js";
import {
  rateLimiterService,
  type RateLimitResult,
} from "../modules/rate-limit/rate-limiter.service.js";

declare module "fastify" {
  interface FastifyContextConfig {
    /** Fastify equivalent of NestJS @RateLimit() decorator metadata. */
    rateLimit?: RateLimitPolicyKey | RateLimitRouteConfig;
  }
}

export type RateLimitRouteConfig = {
  policy: RateLimitPolicyKey;
  by: "ip" | "user";
};

type ResolvedRateLimit = {
  policy: RateLimitPolicy;
  by: "ip" | "user";
};

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const HEAVY_ADMIN_PATHS: Array<{ method: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/api\/v1\/imports\/upload$/ },
  { method: "POST", pattern: /^\/api\/v1\/imports\/[^/]+\/validate$/ },
  { method: "POST", pattern: /^\/api\/v1\/imports\/[^/]+\/start$/ },
  { method: "POST", pattern: /^\/api\/v1\/publish\/dry-run$/ },
  { method: "POST", pattern: /^\/api\/v1\/publish\/run$/ },
  { method: "POST", pattern: /^\/api\/v1\/publish\/jobs\/[^/]+\/retry$/ },
  { method: "POST", pattern: /^\/api\/v1\/search\/reindex$/ },
  { method: "POST", pattern: /^\/api\/v1\/search\/index-product\/[^/]+$/ },
  { method: "POST", pattern: /^\/api\/v1\/search\/remove-product\/[^/]+$/ },
  { method: "POST", pattern: /^\/api\/v1\/events\/replay$/ },
  { method: "POST", pattern: /^\/api\/v1\/events\/[^/]+\/retry$/ },
  { method: "POST", pattern: /^\/api\/v1\/mdm\/products\/inbound$/ },
];

function requestPath(request: FastifyRequest): string {
  return request.url.split("?")[0] ?? request.url;
}

export function resolveClientIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || request.ip;
  }
  return request.ip;
}

function normalizeRouteConfig(
  config: RateLimitPolicyKey | RateLimitRouteConfig | undefined,
): ResolvedRateLimit | null {
  if (!config) return null;
  if (typeof config === "string") {
    return { policy: rateLimitPolicies[config], by: config === "login" ? "ip" : "user" };
  }
  return { policy: rateLimitPolicies[config.policy], by: config.by };
}

function matchesHeavyAdminPath(path: string, method: string): boolean {
  return HEAVY_ADMIN_PATHS.some((entry) => entry.method === method && entry.pattern.test(path));
}

export function resolveRateLimitForRequest(request: FastifyRequest): ResolvedRateLimit | null {
  const explicit = normalizeRouteConfig(request.routeOptions.config?.rateLimit);
  if (explicit) return explicit;

  const path = requestPath(request);
  const method = request.method;

  if (method === "POST" && path === "/api/v1/auth/login") {
    return { policy: rateLimitPolicies.login, by: "ip" };
  }

  if (!path.startsWith("/api/v1/") || !WRITE_METHODS.has(method)) {
    return null;
  }

  if (matchesHeavyAdminPath(path, method)) {
    return { policy: rateLimitPolicies.heavyAdmin, by: "user" };
  }

  return { policy: rateLimitPolicies.adminWrite, by: "user" };
}

export function applyRateLimitHeaders(
  reply: FastifyReply,
  policy: RateLimitPolicy,
  result: RateLimitResult,
): void {
  reply.header("X-RateLimit-Limit", String(policy.maxTokens));
  reply.header("X-RateLimit-Remaining", String(result.remaining));
  reply.header("X-RateLimit-Reset", String(result.resetAt));
}

export function sendRateLimited(
  reply: FastifyReply,
  policy: RateLimitPolicy,
  result: RateLimitResult,
): void {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  applyRateLimitHeaders(reply, policy, result);
  reply
    .header("Retry-After", String(retryAfterSeconds))
    .code(429)
    .send({
      code: "RATE_LIMITED",
      message: "Too many requests. Please retry later.",
      bucket: policy.bucketName,
      retry_after_seconds: retryAfterSeconds,
    });
}

async function enforceResolvedRateLimit(
  request: FastifyRequest,
  reply: FastifyReply,
  resolved: ResolvedRateLimit,
): Promise<boolean> {
  let result: RateLimitResult;

  if (resolved.by === "ip") {
    result = await rateLimiterService.checkIpLimit(resolveClientIp(request), resolved.policy);
  } else {
    const userId = request.authUser?.sub;
    if (!userId || request.authUser?.isAnonymous) {
      return true;
    }
    result = await rateLimiterService.checkUserLimit(userId, resolved.policy);
  }

  applyRateLimitHeaders(reply, resolved.policy, result);
  if (!result.allowed) {
    sendRateLimited(reply, resolved.policy, result);
    return false;
  }

  return true;
}

/** NestJS @RateLimit() equivalent for Fastify route config. */
export function RateLimit(
  policyKey: RateLimitPolicyKey,
  by: "ip" | "user" = policyKey === "login" ? "ip" : "user",
): { rateLimit: RateLimitRouteConfig } {
  return { rateLimit: { policy: policyKey, by } };
}

/** Per-route preHandler matching @RateLimit(policyKey). */
export function rateLimitPreHandler(
  policyKey: RateLimitPolicyKey,
  by: "ip" | "user" = policyKey === "login" ? "ip" : "user",
): preHandlerHookHandler {
  const resolved: ResolvedRateLimit = { policy: rateLimitPolicies[policyKey], by };
  return async (request, reply) => {
    const allowed = await enforceResolvedRateLimit(request, reply, resolved);
    if (!allowed) return reply;
  };
}

export const enforceRateLimit: preHandlerHookHandler = async (request, reply) => {
  const resolved = resolveRateLimitForRequest(request);
  if (!resolved) return;
  const allowed = await enforceResolvedRateLimit(request, reply, resolved);
  if (!allowed) return reply;
};

/**
 * Registers a global preHandler on the root app (call after route plugins).
 * Child route auth hooks run first; this runs after JWT is available.
 */
export function registerRateLimitHook(app: FastifyInstance): void {
  app.addHook("preHandler", enforceRateLimit);
}
