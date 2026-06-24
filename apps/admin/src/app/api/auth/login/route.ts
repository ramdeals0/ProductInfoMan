import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, authCookieOptions, getApiBaseUrl } from "@/lib/auth";

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
      token?: string;
      user?: Record<string, unknown>;
      error?: string;
    };

    if (!response.ok || !payload.token) {
      return NextResponse.json(
        { error: payload.error ?? "Invalid email or password" },
        { status: response.status === 401 ? 401 : 400 },
      );
    }

    const result = NextResponse.json({ user: payload.user });
    result.cookies.set(AUTH_COOKIE, payload.token, authCookieOptions());
    return result;
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
