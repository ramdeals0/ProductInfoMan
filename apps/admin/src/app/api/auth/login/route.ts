import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, REFRESH_COOKIE, authCookieOptions, getApiBaseUrl, refreshCookieOptions } from "@/lib/auth";

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1).default("demo"),
});

export async function POST(request: Request) {
  try {
    const body = LoginBodySchema.parse(await request.json());
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as {
      accessToken?: string;
      token?: string;
      refreshToken?: string;
      user?: Record<string, unknown>;
      error?: string;
      code?: string;
    };

    const accessToken = payload.accessToken ?? payload.token;
    if (!response.ok || !accessToken) {
      return NextResponse.json(
        { error: payload.error ?? "Invalid email or password", code: payload.code },
        { status: response.status },
      );
    }

    const result = NextResponse.json({ user: payload.user });
    result.cookies.set(AUTH_COOKIE, accessToken, authCookieOptions(60 * 30));
    if (payload.refreshToken) {
      result.cookies.set(REFRESH_COOKIE, payload.refreshToken, refreshCookieOptions());
    }
    return result;
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
