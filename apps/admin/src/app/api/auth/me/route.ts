import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, getApiBaseUrl, verifyAuthToken } from "@/lib/auth";

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyAuthToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
  }

  const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Organization-Slug": process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? "demo",
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }

  return NextResponse.json(payload);
}
