import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifyAuthToken } from "./src/lib/auth";
import { canAccessAdminRoute } from "./src/lib/permissions";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/v1/")) {
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    try {
      await verifyAuthToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Authorization", `Bearer ${token}`);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/admin")) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const claims = await verifyAuthToken(token);
      if (!canAccessAdminRoute(pathname, claims.roles)) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      return NextResponse.next();
    } catch {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_COOKIE);
      return response;
    }
  }

  if (pathname === "/login" && token) {
    try {
      await verifyAuthToken(token);
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    } catch {
      const response = NextResponse.next();
      response.cookies.delete(AUTH_COOKIE);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/api/v1/:path*"],
};
