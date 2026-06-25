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
import { useToast } from "@/components/ui/Toast";
import { IMPORT_POLL_INTERVAL_MS, isActiveImportStatus } from "@/lib/import-jobs";
import { useSession } from "@/lib/session";

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function invalidateImportActivity(
  queryClient: ReturnType<typeof useQueryClient>,
  importId: string,
) {
  queryClient.invalidateQueries({ queryKey: ["import", importId] });
  queryClient.invalidateQueries({ queryKey: ["import-errors", importId] });
  queryClient.invalidateQueries({ queryKey: ["import-rows", importId] });
  queryClient.invalidateQueries({ queryKey: ["imports"] });
  queryClient.invalidateQueries({ queryKey: ["reports-summary"] });
}

export default function ImportDetailPage() {
  const params = useParams<{ id: string }>();
  const { api } = useSession();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const jobQuery = useQuery({
    queryKey: ["import", params.id],
    queryFn: () => api.getImport(params.id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isActiveImportStatus(status) ? IMPORT_POLL_INTERVAL_MS : false;
    },
  });

  const errorsQuery = useQuery({
    queryKey: ["import-errors", params.id],
    queryFn: () => api.getImportErrors(params.id),
    enabled: !!jobQuery.data,
    refetchInterval: jobQuery.data && isActiveImportStatus(jobQuery.data.status)
      ? IMPORT_POLL_INTERVAL_MS
      : false,
  });

  const rowsQuery = useQuery({
    queryKey: ["import-rows", params.id],
    queryFn: () => api.getImportRows(params.id, 10),
    enabled: !!jobQuery.data,
    refetchInterval: jobQuery.data && isActiveImportStatus(jobQuery.data.status)
      ? IMPORT_POLL_INTERVAL_MS
      : false,
  });

  const validateMutation = useMutation({
    mutationFn: () => api.validateImport(params.id),
    onSuccess: (job) => {
      invalidateImportActivity(queryClient, params.id);
      if (job.status === "VALIDATION_FAILED") {
        pushToast(
          job.validRows > 0
            ? `Validation finished with ${job.invalidRows} invalid row(s)`
            : "Validation failed — no valid rows found",
          job.validRows > 0 ? "info" : "error",
        );
      } else {
        pushToast(
          `Validation complete — ${job.validRows} valid, ${job.invalidRows} invalid row(s)`,
          "success",
        );
      }
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const startMutation = useMutation({
    mutationFn: () => api.startImport(params.id),
    onSuccess: () => {
      invalidateImportActivity(queryClient, params.id);
      pushToast("Import started — processing rows in the background", "success");
    },
    onError: (err) => pushToast((err as Error).message, "error"),
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
  const isJobActive = isActiveImportStatus(job.status);
  const canValidate =
    !validateMutation.isPending &&
    !isJobActive &&
    !["QUEUED", "PROCESSING", "COMPLETED"].includes(job.status);
  const canStart =
    !startMutation.isPending &&
    !isJobActive &&
    job.status === "VALIDATED" &&
    job.validRows > 0;

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

      {isJobActive ? (
        <p className="mb-6 text-sm text-blue-700">
          {job.status === "VALIDATING"
            ? "Validating import file…"
            : job.status === "QUEUED"
              ? "Import queued — waiting to start…"
              : "Import in progress — row counts update automatically."}
        </p>
      ) : null}

      <div className="mb-6 flex gap-2">
        <button
          className="btn-secondary"
          disabled={!canValidate}
          onClick={() => validateMutation.mutate()}
        >
          {validateMutation.isPending ? "Validating…" : "Validate"}
        </button>
        <button
          className="btn-primary"
          disabled={!canStart}
          onClick={() => startMutation.mutate()}
        >
          {startMutation.isPending ? "Starting…" : "Start import"}
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
