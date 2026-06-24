"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";
import { formatUserFacingError } from "@/lib/errors";

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

  const dashboard = useQuery({
    queryKey: ["reports-dashboard"],
    queryFn: () => api.getReportsDashboard(),
  });
  const completeness = useQuery({
    queryKey: ["reports-completeness"],
    queryFn: () => api.getReportsCompleteness(),
  });
  const workflow = useQuery({
    queryKey: ["reports-workflow"],
    queryFn: () => api.getReportsWorkflow(),
  });
  const imports = useQuery({
    queryKey: ["reports-imports"],
    queryFn: () => api.getReportsImports(),
  });
  const publishes = useQuery({
    queryKey: ["reports-publishes"],
    queryFn: () => api.getReportsPublishes(),
  });

  const isLoading =
    dashboard.isLoading ||
    completeness.isLoading ||
    workflow.isLoading ||
    imports.isLoading ||
    publishes.isLoading;

  const error =
    dashboard.error ?? completeness.error ?? workflow.error ?? imports.error ?? publishes.error;

  const categoryColumns = useMemo<
    ColumnDef<{ categoryName: string; productCount: number; averageScore: number }>[]
  >(
    () => [
      { header: "Category", accessorKey: "categoryName" },
      { header: "Products", accessorKey: "productCount" },
      {
        header: "Completeness",
        cell: ({ row }) => `${row.original.averageScore}%`,
      },
    ],
    [],
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={formatUserFacingError(error)} />;

  const dash = dashboard.data!;
  const comp = completeness.data!;
  const wf = workflow.data!;
  const imp = imports.data!;
  const pub = publishes.data!;

  return (
    <div>
      <PageHeader
        title="Operations reports"
        description="Dashboard, completeness, workflow throughput, and import/publish success rates."
      />

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Dashboard</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total products" value={dash.totalProducts} />
          <MetricCard label="Approved products" value={dash.approvedProducts} />
          <MetricCard label="Published products" value={dash.publishedProducts} />
          <MetricCard
            label="Average completeness"
            value={`${dash.averageCompletenessScore}%`}
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MetricCard
            label="Import jobs"
            value={`${dash.imports.completedJobs}/${dash.imports.totalJobs} completed`}
            hint={`Success rate ${dash.imports.successRate}%`}
          />
          <MetricCard
            label="Publish jobs"
            value={`${dash.publishing.completedJobs}/${dash.publishing.totalJobs} completed`}
            hint={`Success rate ${dash.publishing.successRate}%`}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Completeness</h2>
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <MetricCard label="Global score" value={`${comp.globalScore}%`} />
          <MetricCard label="Products measured" value={comp.totalProducts} />
          <MetricCard label="Categories" value={comp.byCategory.length} />
        </div>
        {comp.byCategory.length > 0 ? (
          <DataTable data={comp.byCategory} columns={categoryColumns} />
        ) : (
          <p className="text-sm text-slate-500">No category completeness data for this period.</p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Workflow throughput</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Transitions to approved" value={wf.transitionsToApproved} />
          <MetricCard label="Transitions to published" value={wf.transitionsToPublished} />
          <MetricCard label="Total transitions" value={wf.totalTransitions} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Imports</h2>
        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <MetricCard label="Total jobs" value={imp.totalJobs} />
          <MetricCard label="Completed" value={imp.completedJobs} />
          <MetricCard label="Failed" value={imp.failedJobs} />
          <MetricCard label="Avg valid row rate" value={`${imp.averageValidRowRate}%`} />
        </div>
        <ul className="card divide-y divide-slate-100 text-sm">
          {imp.jobs.slice(0, 10).map((job) => (
            <li key={job.importJobId} className="flex items-center justify-between px-4 py-3">
              <span>{job.fileName}</span>
              <div className="flex items-center gap-3">
                <StatusChip status={job.status} />
                <span>{job.successRate}% valid</span>
              </div>
            </li>
          ))}
          {imp.jobs.length === 0 ? (
            <li className="px-4 py-3 text-slate-500">No import jobs in this period.</li>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Publishing</h2>
        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <MetricCard label="Total jobs" value={pub.totalJobs} />
          <MetricCard label="Completed" value={pub.completedJobs} />
          <MetricCard label="Failed" value={pub.failedJobs} />
          <MetricCard label="Avg item success" value={`${pub.averageItemSuccessRate}%`} />
        </div>
        <ul className="card divide-y divide-slate-100 text-sm">
          {pub.jobs.slice(0, 10).map((job) => (
            <li key={job.publishJobId} className="flex items-center justify-between px-4 py-3">
              <span>
                {job.mode} · {job.publishJobId.slice(0, 8)}…
              </span>
              <div className="flex items-center gap-3">
                <StatusChip status={job.status} />
                <span>
                  {job.successfulItems}/{job.totalItems} items
                </span>
              </div>
            </li>
          ))}
          {pub.jobs.length === 0 ? (
            <li className="px-4 py-3 text-slate-500">No publish jobs in this period.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
