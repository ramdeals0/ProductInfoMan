import type { FastifyRequest, preHandlerHookHandler } from "fastify";
import {
  hasAnyRole,
  hasCapability,
  hasCapabilityGroup,
  primaryLegacyRole,
  ROLE_GROUPS,
  ROLE_GROUP_CAPABILITIES,
  type Capability,
} from "@productinfoman/shared";

export { ROLE_GROUPS };
import type { UserRole } from "../../../generated/prisma/client.js";
import { assertAccessTokenVersion } from "../modules/auth/auth.service.js";
import { verifyToken, type JwtPayload } from "../modules/auth/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: JwtPayload & { isAnonymous?: boolean };
  }
}

const PUBLIC_READ_PREFIXES = [
  "/products",
  "/categories",
  "/search",
] as const;

function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

function isPublicReadRoute(request: FastifyRequest): boolean {
  if (request.method !== "GET") return false;
  let path = request.url.split("?")[0] ?? request.url;
  if (path.startsWith("/api/v1")) {
    path = path.slice("/api/v1".length) || "/";
  }
  return PUBLIC_READ_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Authenticates JWT Bearer tokens. Anonymous GET catalog/search routes are allowed
 * for the headless storefront (implicit readonly within tenant scope).
 */
export const authenticateJwt: preHandlerHookHandler = async (request) => {
  const token = extractBearerToken(request);
  if (token) {
    const payload = await verifyToken(token);
    await assertAccessTokenVersion(payload);
    if (request.organizationId && payload.organizationId !== request.organizationId) {
      throw Object.assign(new Error("Token organization mismatch"), { statusCode: 403 });
    }
    request.authUser = payload;
    request.actorUserId = payload.sub;
    request.actorRole = primaryLegacyRole(payload.roles) as UserRole;
    return;
  }

  if (isPublicReadRoute(request)) {
    request.authUser = {
      sub: "anonymous",
      email: "",
      organizationId: request.organizationId,
      organizationSlug: (request.headers["x-organization-slug"] as string) ?? "demo",
      roles: ["readonly"],
      isAnonymous: true,
    };
    request.actorRole = "VIEWER";
    return;
  }

  throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
};

/** Require at least one of the given RBAC role codes. Admin always passes. */
export function requireRoles(requiredRoles: readonly string[]): preHandlerHookHandler {
  return requireRolesLegacy(requiredRoles);
}

/** Capability-based guard (preferred). */
export function requireCapabilities(required: Capability | readonly Capability[]): preHandlerHookHandler {
  return async (request) => {
    if (!request.authUser) {
      throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
    }
    if (request.authUser.isAnonymous) {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    if (!hasCapability(request.authUser.roles, required)) {
      throw Object.assign(new Error("Forbidden: insufficient permissions"), { statusCode: 403 });
    }
  };
}

/** Maps legacy ROLE_GROUPS to capability checks (any capability in group). */
export function requireRoleGroup(
  group: keyof typeof ROLE_GROUP_CAPABILITIES,
): preHandlerHookHandler {
  return async (request) => {
    if (!request.authUser) {
      throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
    }
    if (request.authUser.isAnonymous) {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    if (!hasCapabilityGroup(request.authUser.roles, group)) {
      throw Object.assign(new Error("Forbidden: insufficient permissions"), { statusCode: 403 });
    }
  };
}

/** @deprecated Prefer requireRoleGroup or requireCapabilities */
export function requireRolesLegacy(requiredRoles: readonly string[]): preHandlerHookHandler {
  return async (request) => {
    if (!request.authUser) {
      throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
    }
    if (request.authUser.isAnonymous) {
      throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    }
    if (!hasAnyRole(request.authUser.roles, requiredRoles)) {
      throw Object.assign(new Error("Forbidden: insufficient role"), { statusCode: 403 });
    }
  };
}

/** Imperative capability check for route handlers. */
export function assertCapabilities(request: FastifyRequest, required: Capability | readonly Capability[]): void {
  if (!request.authUser) {
    throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  }
  if (request.authUser.isAnonymous) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  if (!hasCapability(request.authUser.roles, required)) {
    throw Object.assign(new Error("Forbidden: insufficient permissions"), { statusCode: 403 });
  }
}

/** Imperative role group check (maps to capabilities). */
export function assertRoleGroup(request: FastifyRequest, group: keyof typeof ROLE_GROUP_CAPABILITIES): void {
  if (!request.authUser) {
    throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  }
  if (request.authUser.isAnonymous) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  if (!hasCapabilityGroup(request.authUser.roles, group)) {
    throw Object.assign(new Error("Forbidden: insufficient permissions"), { statusCode: 403 });
  }
}

/** Imperative role check for use inside route handlers. */
export function assertRoles(request: FastifyRequest, requiredRoles: readonly string[]): void {
  if (!request.authUser) {
    throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  }
  if (request.authUser.isAnonymous) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
  if (!hasAnyRole(request.authUser.roles, requiredRoles)) {
    throw Object.assign(new Error("Forbidden: insufficient role"), { statusCode: 403 });
  }
}
