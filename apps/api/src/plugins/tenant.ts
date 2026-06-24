import type { FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.js";

declare module "fastify" {
  interface FastifyRequest {
    organizationId: string;
  }
}

const DEFAULT_ORG_SLUG = "demo";

export async function resolveTenant(request: FastifyRequest): Promise<void> {
  const slug = (request.headers["x-organization-slug"] as string) ?? DEFAULT_ORG_SLUG;
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    throw Object.assign(new Error(`Organization not found: ${slug}`), { statusCode: 404 });
  }
  request.organizationId = org.id;
}
