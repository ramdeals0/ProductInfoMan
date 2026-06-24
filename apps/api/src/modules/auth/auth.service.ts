import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { loadApiEnv, validatePassword } from "@productinfoman/config";
import { prisma } from "@productinfoman/db";
import { primaryLegacyRole, recordSecurityEvent } from "@productinfoman/shared";
import type { UserRole } from "../../../../generated/prisma/client.js";
import { getRefreshTokenTtlMs, signAccessToken } from "./jwt.js";

export type AuthUserProfile = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationSlug: string;
  roles: string[];
  legacyRole: UserRole;
  mfaEnabled: boolean;
  mfaType: string | null;
  tokenVersion: number;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const { PASSWORD_SALT_ROUNDS } = loadApiEnv();
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export function assertPasswordPolicy(password: string): void {
  const result = validatePassword(password);
  if (!result.valid) {
    throw new AuthError(result.errors.join("; "), 400, "WEAK_PASSWORD");
  }
}

function isAccountLocked(lockedUntil: Date | null): boolean {
  return Boolean(lockedUntil && lockedUntil.getTime() > Date.now());
}

async function recordLoginFailure(
  user: { id: string; organizationId: string; failedLoginAttempts: number },
  ipAddress?: string,
): Promise<void> {
  const { LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MINUTES } = loadApiEnv();
  const attempts = user.failedLoginAttempts + 1;
  const shouldLock = attempts >= LOGIN_MAX_ATTEMPTS;
  const lockedUntil = shouldLock
    ? new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000)
    : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil,
    },
  });

  await recordSecurityEvent({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LOGIN_FAILURE",
    ipAddress,
    metadata: { attempts, locked: shouldLock },
  });

  if (shouldLock) {
    await recordSecurityEvent({
      organizationId: user.organizationId,
      userId: user.id,
      action: "ACCOUNT_LOCKOUT",
      ipAddress,
      metadata: { attempts, lockedUntil: lockedUntil?.toISOString() },
    });
  }
}

export async function validateUser(
  organizationSlug: string,
  email: string,
  password: string,
  ipAddress?: string,
): Promise<AuthUserProfile> {
  const org = await prisma.organization.findUnique({ where: { slug: organizationSlug } });
  if (!org) {
    throw new AuthError("Invalid email or password", 401);
  }

  const user = await prisma.user.findUnique({
    where: { organizationId_email: { organizationId: org.id, email } },
    include: { roleMemberships: { include: { role: true } } },
  });

  if (!user?.isActive || !user.passwordHash) {
    throw new AuthError("Invalid email or password", 401);
  }

  if (isAccountLocked(user.lockedUntil)) {
    throw new AuthError("Account is temporarily locked. Try again later.", 423, "ACCOUNT_LOCKED");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await recordLoginFailure(user, ipAddress);
    throw new AuthError("Invalid email or password", 401);
  }

  // MFA-ready: when enabled, future flow returns mfa_required instead of issuing tokens.
  if (user.mfaEnabled) {
    // TODO(security): require second factor (TOTP/SMS) before issuing tokens.
    throw new AuthError("MFA verification required", 401, "MFA_REQUIRED");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const roles = user.roleMemberships.map((membership) => membership.role.code);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: org.id,
    organizationSlug: org.slug,
    roles,
    legacyRole: primaryLegacyRole(roles) as UserRole,
    mfaEnabled: user.mfaEnabled,
    mfaType: user.mfaType,
    tokenVersion: user.tokenVersion,
  };
}

export async function issueAuthTokens(profile: AuthUserProfile, ipAddress?: string) {
  const accessToken = await signAccessToken({
    sub: profile.id,
    email: profile.email,
    organizationId: profile.organizationId,
    organizationSlug: profile.organizationSlug,
    roles: profile.roles as AuthUserProfile["roles"],
    tokenVersion: profile.tokenVersion,
  });

  const refreshToken = randomBytes(48).toString("base64url");
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + getRefreshTokenTtlMs(profile.roles));

  await prisma.refreshToken.create({
    data: {
      userId: profile.id,
      tokenHash: refreshTokenHash,
      expiresAt,
    },
  });

  await recordSecurityEvent({
    organizationId: profile.organizationId,
    userId: profile.id,
    action: "LOGIN_SUCCESS",
    performedBy: profile.id,
    ipAddress,
  });

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt.toISOString(),
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      organizationSlug: profile.organizationSlug,
      roles: profile.roles,
      legacyRole: profile.legacyRole,
      mfaEnabled: profile.mfaEnabled,
    },
  };
}

/** @deprecated Use issueAuthTokens */
export async function loginUser(profile: AuthUserProfile, ipAddress?: string) {
  const result = await issueAuthTokens(profile, ipAddress);
  return {
    token: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  };
}

export async function refreshSession(refreshToken: string, ipAddress?: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          organization: true,
          roleMemberships: { include: { role: true } },
        },
      },
    },
  });

  if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
    throw new AuthError("Invalid refresh token", 401);
  }

  const user = stored.user;
  if (!user.isActive || isAccountLocked(user.lockedUntil)) {
    throw new AuthError("Account unavailable", 401);
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const roles = user.roleMemberships.map((membership) => membership.role.code);
  const profile: AuthUserProfile = {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    organizationSlug: user.organization.slug,
    roles,
    legacyRole: primaryLegacyRole(roles) as UserRole,
    mfaEnabled: user.mfaEnabled,
    mfaType: user.mfaType,
    tokenVersion: user.tokenVersion,
  };

  return issueAuthTokens(profile, ipAddress);
}

export async function logoutUser(refreshToken: string | undefined, userId?: string, ipAddress?: string) {
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await recordSecurityEvent({
        organizationId: user.organizationId,
        userId: user.id,
        action: "LOGOUT",
        performedBy: user.id,
        ipAddress,
      });
    }
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
  ]);
}

export async function assertAccessTokenVersion(payload: { sub: string; tokenVersion: number }): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { tokenVersion: true, isActive: true },
  });
  if (!user?.isActive || user.tokenVersion !== payload.tokenVersion) {
    throw Object.assign(new Error("Token revoked"), { statusCode: 401 });
  }
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
    mfaEnabled: user.mfaEnabled,
    mfaType: user.mfaType,
    tokenVersion: user.tokenVersion,
  };
}

export async function unlockUserAccount(
  organizationId: string,
  userId: string,
  performedBy: string,
  ipAddress?: string,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId, organizationId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  await recordSecurityEvent({
    organizationId,
    userId,
    action: "ACCOUNT_UNLOCK",
    performedBy,
    ipAddress,
  });
}
