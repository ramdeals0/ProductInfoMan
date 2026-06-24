"use client";

import { useSession } from "@/lib/session";

export function AdminHeader() {
  const { session, setSession } = useSession();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden text-lg font-semibold text-brand-700">PIM Admin</div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-slate-500">Org</span>
            <input
              className="input max-w-[8rem]"
              value={session.organizationSlug}
              onChange={(e) => setSession({ ...session, organizationSlug: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500">User</span>
            <input
              className="input max-w-[12rem]"
              value={session.userEmail}
              onChange={(e) => setSession({ ...session, userEmail: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-500">Role</span>
            <select
              className="input max-w-[9rem]"
              value={session.actorRole}
              onChange={(e) => setSession({ ...session, actorRole: e.target.value })}
            >
              {["ADMIN", "CATALOG_MANAGER", "EDITOR", "REVIEWER", "VIEWER"].map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
