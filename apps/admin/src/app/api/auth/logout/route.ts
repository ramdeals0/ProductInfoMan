import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, REFRESH_COOKIE, getApiBaseUrl } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;

  if (refreshToken || accessToken) {
    await fetch(`${getApiBaseUrl()}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
