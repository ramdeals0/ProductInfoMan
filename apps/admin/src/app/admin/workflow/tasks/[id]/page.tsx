"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function WorkflowTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const { api } = useSession();

  const { data, isLoading, error } = useQuery({
    queryKey: ["workflow-task", params.id],
    queryFn: () => api.getWorkflowTask(params.id),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const task = data!;

  return (
    <div>
      <Breadcrumb items={[{ label: "Workflow", href: "/admin/workflow" }, { label: task.id }]} />
      <PageHeader
        title={task.productTitle ?? "Workflow task"}
        description={`Task for ${task.productSku ?? "product"}`}
        actions={<StatusChip status={task.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3 p-5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Workflow state</span>
            <span className="font-medium">{task.workflowStateCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Assigned role</span>
            <span className="font-medium">{task.assignedRole}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Product status</span>
            {task.productStatus ? <StatusChip status={task.productStatus} /> : "—"}
          </div>
          {task.productId ? (
            <Link href={`/admin/products/${task.productId}`} className="btn-primary mt-4 inline-flex">
              Open product
            </Link>
          ) : null}
        </div>

        <div className="card p-5">
          <h2 className="font-medium">Approvals</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {task.approvals.map((approval) => (
              <li key={approval.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="font-medium">
                  {approval.approverName} · {approval.decision}
                </div>
                {approval.decisionReason ? (
                  <div className="text-slate-600">{approval.decisionReason}</div>
                ) : null}
              </li>
            ))}
            {task.approvals.length === 0 ? (
              <li className="text-slate-500">No approvals recorded yet.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
