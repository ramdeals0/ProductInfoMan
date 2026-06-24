"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createApiClient, type ApiClient } from "@productinfoman/api-client";

export type SessionConfig = {
  organizationSlug: string;
  userEmail: string;
  actorRole: string;
};

const DEFAULT_SESSION: SessionConfig = {
  organizationSlug: process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? "demo",
  userEmail: "admin@demo.local",
  actorRole: "ADMIN",
};

type SessionContextValue = {
  session: SessionConfig;
  setSession: (session: SessionConfig) => void;
  api: ApiClient;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = "pim-admin-session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SessionConfig>(DEFAULT_SESSION);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSessionState({ ...DEFAULT_SESSION, ...JSON.parse(stored) });
      } catch {
        setSessionState(DEFAULT_SESSION);
      }
    }
    setReady(true);
  }, []);

  const setSession = (next: SessionConfig) => {
    setSessionState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl: "",
        organizationSlug: session.organizationSlug,
        userEmail: session.userEmail,
        actorRole: session.actorRole,
      }),
    [session],
  );

  if (!ready) return null;

  return (
    <SessionContext.Provider value={{ session, setSession, api }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
