import * as jose from "jose";
import type { RbacRoleCode } from "@productinfoman/shared/rbac";

export const AUTH_COOKIE = "pim_auth";

export type AuthSession = {
  id: string;
  email: string;
  name: string;
  organizationSlug: string;
  roles: RbacRoleCode[];
  legacyRole: string;
};

type JwtClaims = {
  sub: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  roles: RbacRoleCode[];
};

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "dev-insecure-jwt-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function verifyAuthToken(token: string): Promise<JwtClaims> {
  const { payload } = await jose.jwtVerify(token, getSecret());
  const sub = payload.sub;
  if (!sub) throw new Error("Invalid token");

  return {
    sub,
    email: String(payload.email ?? ""),
    organizationId: String(payload.organizationId ?? ""),
    organizationSlug: String(payload.organizationSlug ?? ""),
    roles: Array.isArray(payload.roles) ? (payload.roles as RbacRoleCode[]) : [],
  };
}

export function authCookieOptions(maxAgeSeconds = 60 * 60 * 8) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function getApiBaseUrl(): string {
  return process.env.API_URL ?? "http://localhost:3001";
}
