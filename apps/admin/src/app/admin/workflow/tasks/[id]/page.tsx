"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { canApproveWorkflow } from "@/lib/roles";
import { useSession } from "@/lib/session";

export default function WorkflowTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { api, user } = useSession();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["workflow-task", params.id],
    queryFn: () => api.getWorkflowTask(params.id),
  });

  const historyQuery = useQuery({
    queryKey: ["workflow-history", data?.productId],
    queryFn: () => api.getWorkflowHistory(data!.productId!),
    enabled: !!data?.productId,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      api.approveProduct(data!.productId!, {
        ...(reason ? { comments: reason } : {}),
      }),
    onSuccess: () => {
      pushToast("Product approved", "success");
      queryClient.invalidateQueries({ queryKey: ["workflow-task", params.id] });
      router.push("/admin/workflow");
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      api.rejectProduct(data!.productId!, {
        reason,
      }),
    onSuccess: () => {
      pushToast("Product rejected", "success");
      queryClient.invalidateQueries({ queryKey: ["workflow-task", params.id] });
      router.push("/admin/workflow");
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const task = data!;
  const canAct =
    canApproveWorkflow(user?.roles ?? []) &&
    task.status === "OPEN" &&
    !!task.productId;

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

      {historyQuery.data?.items.length ? (
        <div className="card mt-6 p-5">
          <h2 className="font-medium">Workflow history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {historyQuery.data.items.slice(0, 5).map((entry) => (
              <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2">
                {entry.fromState} → {entry.toState} · {entry.actionType}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canAct ? (
        <div className="card mt-6 space-y-4 p-5">
          <h2 className="font-medium">Review actions</h2>
          <textarea
            className="input min-h-24 w-full"
            placeholder="Optional comments or rejection reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              className="btn-primary"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              Approve
            </button>
            <button
              className="btn-secondary"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              Reject
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
