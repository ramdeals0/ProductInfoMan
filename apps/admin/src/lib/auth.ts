import * as jose from "jose";
import { loadAdminEnv } from "@productinfoman/config";
import type { RbacRoleCode } from "@productinfoman/shared/rbac";

export const AUTH_COOKIE = "pim_auth";
export const REFRESH_COOKIE = "pim_refresh";

export type AuthSession = {
  id: string;
  email: string;
  name: string;
  organizationSlug: string;
  roles: RbacRoleCode[];
  legacyRole: string;
  mfaEnabled?: boolean;
};

type JwtClaims = {
  sub: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  roles: RbacRoleCode[];
};

function getSecret(): Uint8Array {
  const { JWT_SECRET } = loadAdminEnv();
  return new TextEncoder().encode(JWT_SECRET);
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

export function authCookieOptions(maxAgeSeconds = 60 * 60) {
  const { NODE_ENV } = loadAdminEnv();
  return {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function refreshCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return authCookieOptions(maxAgeSeconds);
}

export function getApiBaseUrl(): string {
  const { API_URL } = loadAdminEnv();
  return API_URL;
}
