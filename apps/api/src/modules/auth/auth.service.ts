import bcrypt from "bcryptjs";
import { prisma } from "@productinfoman/db";
import { primaryLegacyRole } from "@productinfoman/shared";
import type { UserRole } from "../../../../generated/prisma/client.js";
import { signToken } from "./jwt.js";

export type AuthUserProfile = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationSlug: string;
  roles: string[];
  legacyRole: UserRole;
};

export async function validateUser(
  organizationSlug: string,
  email: string,
  password: string,
): Promise<AuthUserProfile | null> {
  const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
  if (!org) return null;

  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email } },
    include: {
      roleMemberships: { include: { role: true } },
    },
  });

  if (!user?.isActive || !user.passwordHash) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const roles = user.roleMemberships.map((membership) => membership.role.code);
  const legacyRole = primaryLegacyRole(roles) as UserRole;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: org.id,
    organizationSlug: org.slug,
    roles,
    legacyRole,
  };
}

export async function loginUser(profile: AuthUserProfile) {
  const token = await signToken({
    sub: profile.id,
    email: profile.email,
    organizationId: profile.organizationId,
    organizationSlug: profile.organizationSlug,
    roles: profile.roles as AuthUserProfile["roles"],
  });

  return {
    token,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      organizationSlug: profile.organizationSlug,
      roles: profile.roles,
      legacyRole: profile.legacyRole,
    },
  };
}

export async function getUserProfile(userId: string): Promise<AuthUserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      organization: true,
      roleMemberships: { include: { role: true } },
    },
  });

  if (!user?.isActive) return null;

  const roles = user.roleMemberships.map((membership) => membership.role.code);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    organizationSlug: user.organization.slug,
    roles,
    legacyRole: primaryLegacyRole(roles) as UserRole,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
