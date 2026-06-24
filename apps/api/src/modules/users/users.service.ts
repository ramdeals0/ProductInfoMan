import { z } from "zod";
import { validatePassword } from "@productinfoman/config";
import { hashPassword, unlockUserAccount } from "../auth/auth.service.js";
import { prisma } from "@productinfoman/db";
import { recordSecurityEvent } from "@productinfoman/shared";
import type { RbacRoleCode } from "@productinfoman/shared";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(1),
  roleCodes: z.array(z.string()).min(1),
});

const UpdateUserRolesSchema = z.object({
  roleCodes: z.array(z.string()).min(1),
});

export async function listUsers(organizationId: string) {
  const users = await prisma.user.findMany({
    where: { organizationId },
    include: {
      roleMemberships: { include: { role: true } },
    },
    orderBy: { email: "asc" },
  });

  return {
    items: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roles: user.roleMemberships.map((membership) => membership.role.code),
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil?.toISOString() ?? null,
      mfaEnabled: user.mfaEnabled,
      mfaType: user.mfaType,
      createdAt: user.createdAt.toISOString(),
    })),
  };
}

export async function createUser(
  organizationId: string,
  body: z.infer<typeof CreateUserSchema>,
  performedBy: string,
  ipAddress?: string,
) {
  const input = CreateUserSchema.parse(body);
  const passwordCheck = validatePassword(input.password);
  if (!passwordCheck.valid) {
    throw Object.assign(new Error(passwordCheck.errors.join("; ")), { statusCode: 400 });
  }

  const roles = await prisma.role.findMany({
    where: { code: { in: input.roleCodes } },
  });
  if (roles.length !== input.roleCodes.length) {
    throw Object.assign(new Error("One or more role codes are invalid"), { statusCode: 400 });
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      organizationId,
      email: input.email,
      name: input.name,
      passwordHash,
      roleMemberships: {
        create: roles.map((role) => ({ roleId: role.id })),
      },
    },
    include: { roleMemberships: { include: { role: true } } },
  });

  await recordSecurityEvent({
    organizationId,
    userId: user.id,
    action: "ROLE_ASSIGNMENT",
    performedBy,
    ipAddress,
    metadata: { roleCodes: input.roleCodes, action: "create_user" },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roleMemberships.map((membership) => membership.role.code),
  };
}

export async function updateUserRoles(
  organizationId: string,
  userId: string,
  body: z.infer<typeof UpdateUserRolesSchema>,
  performedBy: string,
  ipAddress?: string,
) {
  const input = UpdateUserRolesSchema.parse(body);
  const roles = await prisma.role.findMany({
    where: { code: { in: input.roleCodes } },
  });
  if (roles.length !== input.roleCodes.length) {
    throw Object.assign(new Error("One or more role codes are invalid"), { statusCode: 400 });
  }

  await prisma.$transaction([
    prisma.userRoleMembership.deleteMany({ where: { userId } }),
    prisma.userRoleMembership.createMany({
      data: roles.map((role) => ({ userId, roleId: role.id })),
    }),
  ]);

  await recordSecurityEvent({
    organizationId,
    userId,
    action: "ROLE_ASSIGNMENT",
    performedBy,
    ipAddress,
    metadata: { roleCodes: input.roleCodes as RbacRoleCode[] },
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId, organizationId },
    include: { roleMemberships: { include: { role: true } } },
  });

  return {
    id: user.id,
    email: user.email,
    roles: user.roleMemberships.map((membership) => membership.role.code),
  };
}

export async function unlockUser(
  organizationId: string,
  userId: string,
  performedBy: string,
  ipAddress?: string,
) {
  await unlockUserAccount(organizationId, userId, performedBy, ipAddress);
  return { id: userId, unlocked: true };
}

export { CreateUserSchema, UpdateUserRolesSchema };
