"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createApiClient, type ApiClient } from "@productinfoman/api-client";
import type { AuthSession } from "./auth";

type SessionContextValue = {
  user: AuthSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  api: ApiClient;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (!response.ok) {
      setUser(null);
      return;
    }
    const profile = (await response.json()) as AuthSession;
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (loading || user) return;
    if (!pathname.startsWith("/admin")) return;
    window.location.href = "/login";
  }, [loading, user, pathname]);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: "",
        organizationSlug: user?.organizationSlug ?? process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? "demo",
      }),
    [user?.organizationSlug],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading session...
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ user, loading, refresh, logout, api }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
