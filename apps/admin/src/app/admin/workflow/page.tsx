"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { WorkflowTaskEntity } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function WorkflowPage() {
  const router = useRouter();
  const { api } = useSession();
  const [status, setStatus] = useState("OPEN");

  const { data, isLoading, error } = useQuery({
    queryKey: ["workflow-tasks", status],
    queryFn: () => api.listWorkflowTasks(status ? { status } : {}),
  });

  const columns = useMemo<ColumnDef<WorkflowTaskEntity>[]>(
    () => [
      { header: "Product", cell: ({ row }) => row.original.productTitle ?? row.original.productSku },
      { header: "SKU", accessorKey: "productSku" },
      {
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      {
        header: "Product status",
        cell: ({ row }) =>
          row.original.productStatus ? <StatusChip status={row.original.productStatus} /> : "—",
      },
      { header: "Assigned role", accessorKey: "assignedRole" },
      { header: "State", accessorKey: "workflowStateCode" },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Workflow inbox" description="Tasks waiting for review and approval." />
      <div className="mb-4">
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={(error as Error).message} /> : null}
      {!isLoading && !error && data?.items.length === 0 ? (
        <EmptyState title="No workflow tasks" description="No tasks match the selected filter." />
      ) : null}
      {data?.items.length ? (
        <DataTable
          data={data.items}
          columns={columns}
          onRowClick={(row) => router.push(`/admin/workflow/tasks/${row.id}`)}
        />
      ) : null}
    </div>
  );
}
