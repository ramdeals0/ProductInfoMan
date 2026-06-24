"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/lib/session";

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export default function ReportsPage() {
  const { api } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: () => api.getReportsSummary(),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  return (
    <div>
      <PageHeader
        title="Operations reports"
        description="Catalog completeness, workflow throughput, import success, and publish success."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Catalog completeness" value={`${data!.catalog.completenessPct}%`} />
        <MetricCard label="Approved products" value={data!.catalog.approvedProducts} />
        <MetricCard label="Open workflow tasks" value={data!.workflow.openTasks} />
        <MetricCard label="Dead letter events" value={data!.eventing.deadLetterCount} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-medium">Import success</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Completed</span>
              <span className="font-medium text-emerald-700">{data!.imports.completed}</span>
            </div>
            <div className="flex justify-between">
              <span>Failed</span>
              <span className="font-medium text-red-700">{data!.imports.failed}</span>
            </div>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="font-medium">Publish success</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Completed</span>
              <span className="font-medium text-emerald-700">{data!.publishing.completed}</span>
            </div>
            <div className="flex justify-between">
              <span>Failed</span>
              <span className="font-medium text-red-700">{data!.publishing.failed}</span>
            </div>
            <div className="flex justify-between">
              <span>Active channels</span>
              <span className="font-medium">{data!.publishing.activeChannels}</span>
            </div>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="font-medium">Workflow throughput</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Open</span>
              <span className="font-medium">{data!.workflow.openTasks}</span>
            </div>
            <div className="flex justify-between">
              <span>Completed</span>
              <span className="font-medium">{data!.workflow.completedTasks}</span>
            </div>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="font-medium">Catalog coverage</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total products</span>
              <span className="font-medium">{data!.catalog.totalProducts}</span>
            </div>
            <div className="flex justify-between">
              <span>Categories</span>
              <span className="font-medium">{data!.catalog.categoryCount}</span>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
