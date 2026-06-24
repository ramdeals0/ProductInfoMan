"use client";

import { useSession } from "@/lib/session";
import { formatRoleLabel } from "@/lib/permissions";

export function AdminHeader() {
  const { user, logout } = useSession();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="lg:hidden text-lg font-semibold text-brand-700">PIM Admin</div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {user ? (
            <>
              <div className="text-right">
                <div className="font-medium text-slate-800">{user.name || user.email}</div>
                <div className="text-xs text-slate-500">
                  {user.organizationSlug} · {user.roles.map(formatRoleLabel).join(", ")}
                </div>
              </div>
              <button className="btn-secondary" type="button" onClick={() => logout()}>
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
