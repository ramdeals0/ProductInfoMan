"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ChannelEntity, PublishJobEntity } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function PublishingPage() {
  const router = useRouter();
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [channelId, setChannelId] = useState("");

  const channelsQuery = useQuery({
    queryKey: ["channels"],
    queryFn: () => api.listChannels(),
  });

  const jobsQuery = useQuery({
    queryKey: ["publish-jobs"],
    queryFn: () => api.listPublishJobs({ page: 1, pageSize: 50 }),
  });

  const dryRunMutation = useMutation({
    mutationFn: () => api.dryRunPublish(channelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["publish-jobs"] }),
  });

  const runMutation = useMutation({
    mutationFn: () => api.runPublish(channelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["publish-jobs"] }),
  });

  const columns = useMemo<ColumnDef<PublishJobEntity>[]>(
    () => [
      { header: "Mode", accessorKey: "mode" },
      {
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      { header: "Total", accessorKey: "totalItems" },
      { header: "Success", accessorKey: "successfulItems" },
      { header: "Failed", accessorKey: "failedItems" },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Publishing" description="Channel exports, dry-runs, and publish jobs." />

      <div className="mb-6 card p-5">
        <h2 className="font-medium">Run export</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Channel</label>
            <select className="input min-w-[16rem]" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">Select channel</option>
              {(channelsQuery.data?.items ?? []).map((channel: ChannelEntity) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name} ({channel.code})
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-secondary"
            disabled={!channelId || dryRunMutation.isPending}
            onClick={() => dryRunMutation.mutate()}
          >
            Dry run
          </button>
          <button
            className="btn-primary"
            disabled={!channelId || runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            Run export
          </button>
        </div>
      </div>

      {channelsQuery.data ? (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {channelsQuery.data.items.map((channel) => (
            <div key={channel.id} className="card p-4 text-sm">
              <div className="font-medium">{channel.name}</div>
              <div className="text-slate-500">
                {channel.code} · {channel.destinationType}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {jobsQuery.isLoading ? <LoadingState /> : null}
      {jobsQuery.error ? <ErrorState message={(jobsQuery.error as Error).message} /> : null}
      {!jobsQuery.isLoading && jobsQuery.data?.items.length === 0 ? (
        <EmptyState title="No publish jobs" description="Run a dry-run or live export to get started." />
      ) : null}
      {jobsQuery.data?.items.length ? (
        <DataTable
          data={jobsQuery.data.items}
          columns={columns}
          onRowClick={(row) => router.push(`/admin/publishing/${row.id}`)}
        />
      ) : null}
    </div>
  );
}
