"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/session";

type PublishJobItem = {
  id: string;
  productId: string;
  status: string;
  errorMessage?: string | null;
};

export default function PublishJobDetailPage() {
  const params = useParams<{ id: string }>();
  const { api } = useSession();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["publish-job", params.id],
    queryFn: () => api.getPublishJob(params.id),
  });

  const mappingsQuery = useQuery({
    queryKey: ["channel-mappings", data?.channelId],
    queryFn: () => api.getChannelMappings(data!.channelId),
    enabled: !!data?.channelId,
  });

  const retryMutation = useMutation({
    mutationFn: () => api.retryPublishJob(params.id),
    onSuccess: () => {
      pushToast("Publish job retry queued", "success");
      queryClient.invalidateQueries({ queryKey: ["publish-job", params.id] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const itemColumns = useMemo<ColumnDef<PublishJobItem>[]>(
    () => [
      {
        header: "Product",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.productId.slice(0, 12)}…</span>
        ),
      },
      {
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      {
        header: "Error",
        cell: ({ row }) => row.original.errorMessage ?? "—",
      },
    ],
    [],
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const job = data!;
  const artifact = job.artifacts[0];
  const items = (job.items ?? []) as PublishJobItem[];

  return (
    <div>
      <Breadcrumb items={[{ label: "Publishing", href: "/admin/publishing" }, { label: job.id }]} />
      <PageHeader
        title={`Publish job ${job.mode}`}
        description="Export job status, channel mappings, and artifacts."
        actions={
          <>
            <StatusChip status={job.status} />
            {job.status === "FAILED" ? (
              <button className="btn-secondary" onClick={() => retryMutation.mutate()}>
                Retry
              </button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Total", job.totalItems],
          ["Success", job.successfulItems],
          ["Failed", job.failedItems],
          ["Attempts", job.attempts],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {artifact ? (
        <div className="card mb-6 p-5">
          <h2 className="font-medium">Export artifact</h2>
          <p className="mt-2 text-sm text-slate-600">
            {artifact.fileName} · {artifact.byteSize} bytes
          </p>
          <a className="btn-primary mt-3 inline-flex" href={api.getPublishArtifactUrl(job.id)}>
            Download {artifact.fileType.toUpperCase()}
          </a>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="card mb-6 overflow-hidden p-5">
          <h2 className="mb-4 font-medium">Job items</h2>
          <DataTable data={items} columns={itemColumns} />
        </div>
      ) : null}

      {mappingsQuery.data ? (
        <div className="card p-5">
          <h2 className="font-medium">Channel mappings</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {mappingsQuery.data.items.map((mapping) => (
              <li key={String(mapping.id)} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{String(mapping.sourceField)}</span>
                <span className="font-medium">→ {String(mapping.targetField)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
