"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { ImportJobErrorEntity } from "@productinfoman/domain";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function ImportDetailPage() {
  const params = useParams<{ id: string }>();
  const { api } = useSession();
  const queryClient = useQueryClient();

  const jobQuery = useQuery({
    queryKey: ["import", params.id],
    queryFn: () => api.getImport(params.id),
  });

  const errorsQuery = useQuery({
    queryKey: ["import-errors", params.id],
    queryFn: () => api.getImportErrors(params.id),
    enabled: !!jobQuery.data,
  });

  const validateMutation = useMutation({
    mutationFn: () => api.validateImport(params.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["import", params.id] }),
  });

  const startMutation = useMutation({
    mutationFn: () => api.startImport(params.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["import", params.id] }),
  });

  const errorColumns = useMemo<ColumnDef<ImportJobErrorEntity>[]>(
    () => [
      { header: "Row", accessorKey: "rowNumber" },
      { header: "Field", accessorKey: "fieldName" },
      { header: "Code", accessorKey: "errorCode" },
      { header: "Message", accessorKey: "errorMessage" },
    ],
    [],
  );

  if (jobQuery.isLoading) return <LoadingState />;
  if (jobQuery.error) return <ErrorState message={(jobQuery.error as Error).message} />;

  const job = jobQuery.data!;

  return (
    <div>
      <Breadcrumb items={[{ label: "Imports", href: "/admin/imports" }, { label: job.fileName }]} />
      <PageHeader
        title={job.fileName}
        description="Import job status, validation, and error report."
        actions={<StatusChip status={job.status} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Total", job.totalRows],
          ["Valid", job.validRows],
          ["Invalid", job.invalidRows],
          ["Committed", job.committedRows],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex gap-2">
        <button className="btn-secondary" onClick={() => validateMutation.mutate()}>
          Validate
        </button>
        <button className="btn-primary" onClick={() => startMutation.mutate()}>
          Start import
        </button>
        <a className="btn-secondary" href={`/api/v1/imports/${job.id}/report`}>
          Download error CSV
        </a>
      </div>

      {errorsQuery.data?.items.length ? (
        <>
          <h2 className="mb-3 font-medium">Validation errors</h2>
          <DataTable data={errorsQuery.data.items} columns={errorColumns} />
        </>
      ) : (
        <p className="text-sm text-slate-600">No validation errors recorded.</p>
      )}
    </div>
  );
}
