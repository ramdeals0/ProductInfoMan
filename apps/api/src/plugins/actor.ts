import type { FastifyRequest } from "fastify";
import { primaryLegacyRole } from "@productinfoman/shared";
import { prisma } from "@productinfoman/db";
import type { UserRole } from "../../../../generated/prisma/client.js";

declare module "fastify" {
  interface FastifyRequest {
    actorUserId?: string;
    actorRole?: UserRole;
  }
}

/** Resolve actor from JWT (set by authenticateJwt) or legacy headers. */
export async function resolveActor(request: FastifyRequest): Promise<void> {
  if (request.authUser && !request.authUser.isAnonymous) {
    request.actorUserId = request.authUser.sub;
    request.actorRole = primaryLegacyRole(request.authUser.roles) as UserRole;
    return;
  }

  const email = request.headers["x-user-email"] as string | undefined;
  if (!email) return;

  const user = await prisma.user.findFirst({
    where: {
      organizationId: request.organizationId,
      email,
    },
  });

  if (user) {
    request.actorUserId = user.id;
    request.actorRole = user.role;
  }
}

export function requireActor(request: FastifyRequest): { userId?: string; role: UserRole } {
  const role =
    (request.headers["x-actor-role"] as UserRole | undefined) ?? request.actorRole;
  if (!role) {
    throw Object.assign(new Error("Actor role is required"), { statusCode: 401 });
  }
  return { userId: request.actorUserId, role };
}
