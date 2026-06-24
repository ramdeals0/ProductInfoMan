"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ImportJobEntity } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function ImportsPage() {
  const router = useRouter();
  const { api } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["imports"],
    queryFn: () => api.listImports({ page: 1, pageSize: 50 }),
  });

  const columns = useMemo<ColumnDef<ImportJobEntity>[]>(
    () => [
      { header: "File", accessorKey: "fileName" },
      {
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      { header: "Total rows", accessorKey: "totalRows" },
      { header: "Valid", accessorKey: "validRows" },
      { header: "Invalid", accessorKey: "invalidRows" },
      { header: "Committed", accessorKey: "committedRows" },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Imports" description="Monitor CSV import jobs, validation, and processing." />
      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={(error as Error).message} /> : null}
      {!isLoading && !error && data?.items.length === 0 ? (
        <EmptyState title="No import jobs" description="Upload imports via the API to see them here." />
      ) : null}
      {data?.items.length ? (
        <DataTable
          data={data.items}
          columns={columns}
          onRowClick={(row) => router.push(`/admin/imports/${row.id}`)}
        />
      ) : null}
    </div>
  );
}
