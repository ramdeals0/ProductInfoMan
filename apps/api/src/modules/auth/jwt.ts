import * as jose from "jose";
import { loadApiEnv } from "@productinfoman/config";
import type { RbacRoleCode } from "@productinfoman/shared";

export type JwtPayload = {
  sub: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  roles: RbacRoleCode[];
  tokenVersion: number;
};

function getSecret(): Uint8Array {
  const { JWT_SECRET } = loadApiEnv();
  return new TextEncoder().encode(JWT_SECRET);
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  const { JWT_ACCESS_EXPIRES_IN } = loadApiEnv();
  return new jose.SignJWT({
    email: payload.email,
    organizationId: payload.organizationId,
    organizationSlug: payload.organizationSlug,
    roles: payload.roles,
    tokenVersion: payload.tokenVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(JWT_ACCESS_EXPIRES_IN)
    .sign(getSecret());
}

/** @deprecated Use signAccessToken */
export async function signToken(payload: Omit<JwtPayload, "tokenVersion"> & { tokenVersion?: number }): Promise<string> {
  return signAccessToken({ ...payload, tokenVersion: payload.tokenVersion ?? 0 });
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, getSecret());
  const sub = payload.sub;
  if (!sub) throw new Error("Invalid token: missing subject");

  return {
    sub,
    email: String(payload.email ?? ""),
    organizationId: String(payload.organizationId ?? ""),
    organizationSlug: String(payload.organizationSlug ?? ""),
    roles: Array.isArray(payload.roles) ? (payload.roles as RbacRoleCode[]) : [],
    tokenVersion: Number(payload.tokenVersion ?? 0),
  };
}

export function getRefreshTokenTtlMs(roles: string[] = []): number {
  const { JWT_REFRESH_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN_PRIVILEGED } = loadApiEnv();
  const privileged = roles.some((role) => role === "admin" || role === "product_approver");
  const ttl = privileged ? JWT_REFRESH_EXPIRES_IN_PRIVILEGED : JWT_REFRESH_EXPIRES_IN;
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (multipliers[unit] ?? 3_600_000);
}
