"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function DashboardPage() {
  const { api } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports-summary"],
    queryFn: () => api.getReportsSummary(),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const cards = [
    { label: "Total products", value: data!.catalog.totalProducts, href: "/admin/products" },
    { label: "Approved products", value: data!.catalog.approvedProducts, href: "/admin/products" },
    {
      label: "Catalog completeness",
      value: `${data!.catalog.completenessPct}%`,
      href: "/admin/reports",
    },
    { label: "Open workflow tasks", value: data!.workflow.openTasks, href: "/admin/workflow" },
    { label: "Import jobs completed", value: data!.imports.completed, href: "/admin/imports" },
    { label: "Publish jobs completed", value: data!.publishing.completed, href: "/admin/publishing" },
  ];

  return (
    <div>
      <PageHeader
        title="Operations dashboard"
        description="Overview of catalog health, workflow throughput, imports, and publishing."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card p-5 hover:border-brand-200">
            <div className="text-sm text-slate-600">{card.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</div>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-medium text-slate-900">Product status</h2>
          <dl className="mt-4 space-y-2">
            {Object.entries(data!.catalog.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <StatusChip status={status} />
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="font-medium text-slate-900">Eventing health</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {Object.entries(data!.eventing.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between">
                <span className="text-slate-600">{status}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-600">Dead letters</span>
              <span className="font-medium text-red-700">{data!.eventing.deadLetterCount}</span>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
