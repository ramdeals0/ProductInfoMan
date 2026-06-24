"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { AuditLogEntity } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function AuditPage() {
  const { api } = useSession();
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", entityType, action],
    queryFn: () =>
      api.listAudit({
        page: 1,
        pageSize: 50,
        ...(entityType ? { entityType } : {}),
        ...(action ? { action } : {}),
      }),
  });

  const columns = useMemo<ColumnDef<AuditLogEntity>[]>(
    () => [
      {
        header: "When",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      { header: "Entity", accessorKey: "entityType" },
      { header: "Entity ID", accessorKey: "entityId" },
      {
        header: "Action",
        cell: ({ row }) => <StatusChip status={row.original.action} />,
      },
      { header: "Product", accessorKey: "productId" },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Audit history" description="Filterable audit trail across catalog operations." />
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        />
        <select className="input max-w-xs" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {["CREATE", "UPDATE", "DELETE", "STATE_CHANGE", "IMPORT", "EXPORT"].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={(error as Error).message} /> : null}
      {data ? (
        <>
          <DataTable data={data.items} columns={columns} />
          <p className="mt-3 text-sm text-slate-500">{data.total} audit entries</p>
        </>
      ) : null}
    </div>
  );
}
