"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import type { ImportJobErrorEntity, ImportJobRowEntity } from "@productinfoman/domain";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

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

  const rowsQuery = useQuery({
    queryKey: ["import-rows", params.id],
    queryFn: () => api.getImportRows(params.id, 10),
    enabled: !!jobQuery.data,
  });

  const validateMutation = useMutation({
    mutationFn: () => api.validateImport(params.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import", params.id] });
      queryClient.invalidateQueries({ queryKey: ["import-errors", params.id] });
      queryClient.invalidateQueries({ queryKey: ["import-rows", params.id] });
    },
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

  const previewColumns = useMemo<ColumnDef<ImportJobRowEntity>[]>(
    () => [
      { header: "Row", accessorKey: "rowNumber" },
      {
        header: "Status",
        accessorKey: "status",
      },
      {
        header: "Preview",
        cell: ({ row }) => (
          <code className="block max-w-xl overflow-x-auto whitespace-pre-wrap text-xs">
            {Object.entries(row.original.rawData)
              .slice(0, 8)
              .map(([key, value]) => `${key}: ${formatPreviewValue(value)}`)
              .join(" | ")}
          </code>
        ),
      },
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

      <div className="mb-6 grid gap-4 sm:grid-cols-5">
        {[
          ["File type", job.fileType],
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

      {job.errorMessage ? (
        <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {job.errorMessage}
        </div>
      ) : null}

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

      {rowsQuery.data?.items.length ? (
        <>
          <h2 className="mb-3 font-medium">Row preview</h2>
          <DataTable data={rowsQuery.data.items} columns={previewColumns} />
        </>
      ) : null}

      {errorsQuery.data?.items.length ? (
        <>
          <h2 className="mb-3 mt-8 font-medium">Validation errors</h2>
          <DataTable data={errorsQuery.data.items} columns={errorColumns} />
        </>
      ) : (
        <p className="mt-6 text-sm text-slate-600">No validation errors recorded.</p>
      )}
    </div>
  );
}
