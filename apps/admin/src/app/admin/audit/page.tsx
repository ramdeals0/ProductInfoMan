"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { AuditLogEntity } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { AuditDetailPanel } from "@/components/ui/AuditDetailPanel";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function AuditPage() {
  const { api } = useSession();
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [entityId, setEntityId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", entityType, action, entityId],
    queryFn: () =>
      api.listAudit({
        page: 1,
        pageSize: 50,
        ...(entityType ? { entityType } : {}),
        ...(action ? { action } : {}),
        ...(entityId ? { entityId } : {}),
      }),
  });

  const selectedQuery = useQuery({
    queryKey: ["audit-log", selectedId],
    queryFn: () => api.getAuditLog(selectedId!),
    enabled: !!selectedId,
  });

  const columns = useMemo<ColumnDef<AuditLogEntity>[]>(
    () => [
      {
        header: "When",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      { header: "Entity", accessorKey: "entityType" },
      {
        header: "Entity ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.entityId.slice(0, 12)}…</span>
        ),
      },
      {
        header: "Action",
        cell: ({ row }) => <StatusChip status={row.original.action} />,
      },
      { header: "Source", accessorKey: "source" },
      {
        header: "Actor",
        cell: ({ row }) => row.original.actorId?.slice(0, 10) ?? "—",
      },
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
        <input
          className="input max-w-xs"
          placeholder="Entity ID"
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
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
          <DataTable
            data={data.items}
            columns={columns}
            onRowClick={(row) => setSelectedId(row.id)}
          />
          <p className="mt-3 text-sm text-slate-500">{data.total} audit entries</p>
        </>
      ) : null}

      {selectedId && selectedQuery.data ? (
        <AuditDetailPanel log={selectedQuery.data} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}
