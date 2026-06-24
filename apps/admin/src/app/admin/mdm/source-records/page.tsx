"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { ProductSourceRecordEntity } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

export default function MdmSourceRecordsPage() {
  const router = useRouter();
  const { api } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["mdm-source-records"],
    queryFn: () => api.listMdmSourceRecords({ page: 1, pageSize: 50 }),
  });

  const columns = useMemo<ColumnDef<ProductSourceRecordEntity>[]>(
    () => [
      { header: "Source system", accessorKey: "sourceSystem" },
      { header: "Record ID", accessorKey: "sourceRecordId" },
      {
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      {
        header: "Product",
        cell: ({ row }) => row.original.productId ?? "—",
      },
      {
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="MDM source records"
        description="Steward queue for unmatched or ambiguous inbound product records."
      />
      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={(error as Error).message} /> : null}
      {!isLoading && !error && data?.items.length === 0 ? (
        <EmptyState title="No source records" description="Inbound ERP/PLM feeds will appear here." />
      ) : null}
      {data?.items.length ? (
        <DataTable
          data={data.items}
          columns={columns}
          onRowClick={(row) => router.push(`/admin/mdm/source-records/${row.id}`)}
        />
      ) : null}
    </div>
  );
}
