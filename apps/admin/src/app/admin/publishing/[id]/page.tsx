"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function PublishJobDetailPage() {
  const params = useParams<{ id: string }>();
  const { api } = useSession();
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["publish-job", params.id] }),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;

  const job = data!;
  const artifact = job.artifacts[0];

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
