import * as jose from "jose";
import type { RbacRoleCode } from "@productinfoman/shared";

export type JwtPayload = {
  sub: string;
  email: string;
  organizationId: string;
  organizationSlug: string;
  roles: RbacRoleCode[];
};

const DEFAULT_TTL = "8h";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "dev-insecure-jwt-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT({
    email: payload.email,
    organizationId: payload.organizationId,
    organizationSlug: payload.organizationSlug,
    roles: payload.roles,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? DEFAULT_TTL)
    .sign(getSecret());
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
  };
}
