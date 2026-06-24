import type { FastifyRequest } from "fastify";
import { prisma } from "@productinfoman/db";
import type { UserRole } from "../../../../generated/prisma/client.js";

declare module "fastify" {
  interface FastifyRequest {
    actorUserId?: string;
    actorRole?: UserRole;
  }
}

export async function resolveActor(request: FastifyRequest): Promise<void> {
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
  const role = (request.headers["x-actor-role"] as UserRole | undefined) ?? request.actorRole;
  if (!role) {
    throw Object.assign(new Error("Actor role is required (X-Actor-Role or X-User-Email)"), {
      statusCode: 401,
    });
  }
  return { userId: request.actorUserId, role };
}
