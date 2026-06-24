"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/lib/session";

export default function SecurityPage() {
  const { api } = useSession();

  const policyQuery = useQuery({
    queryKey: ["security-policy"],
    queryFn: () => api.getSecurityPolicy(),
  });

  const auditQuery = useQuery({
    queryKey: ["security-audit"],
    queryFn: () => api.listSecurityAudit({ page: 1, pageSize: 20 }),
  });

  if (policyQuery.isLoading) return <LoadingState />;
  if (policyQuery.error) return <ErrorState message={(policyQuery.error as Error).message} />;

  const policy = policyQuery.data ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Password policy, session settings, and recent security audit events."
      />

      <div className="card p-5 text-sm">
        <h2 className="font-medium">Password policy</h2>
        <pre className="mt-3 overflow-auto rounded-lg bg-slate-50 p-3">
          {JSON.stringify(policy.passwordPolicy ?? {}, null, 2)}
        </pre>
      </div>

      <div className="card p-5 text-sm">
        <h2 className="font-medium">Session policy</h2>
        <ul className="mt-3 space-y-1 text-slate-700">
          <li>Access token TTL: {String(policy.accessTokenTtl ?? "—")}</li>
          <li>Refresh token TTL: {String(policy.refreshTokenTtl ?? "—")}</li>
          <li>Login max attempts: {String(policy.loginMaxAttempts ?? "—")}</li>
          <li>Lockout minutes: {String(policy.lockoutMinutes ?? "—")}</li>
          <li>MFA supported: {String(policy.mfaSupported ?? false)}</li>
        </ul>
      </div>

      <div className="card p-5 text-sm">
        <h2 className="mb-3 font-medium">Recent security events</h2>
        {auditQuery.isLoading ? <LoadingState /> : null}
        {auditQuery.error ? <ErrorState message={(auditQuery.error as Error).message} /> : null}
        <ul className="space-y-2">
          {(auditQuery.data?.items ?? []).map((entry) => (
            <li key={String(entry.id)} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="font-medium">{String(entry.action)}</div>
              <div className="text-slate-500">
                {String(entry.entityId)} · {String(entry.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
