"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ProductEntity } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const router = useRouter();
  const { api } = useSession();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", status, search, page],
    queryFn: () =>
      api.listProducts({
        page,
        pageSize: PAGE_SIZE,
        ...(status ? { status } : {}),
        ...(search ? { title: search } : {}),
      }),
  });

  const columns = useMemo<ColumnDef<ProductEntity>[]>(
    () => [
      { header: "SKU", accessorKey: "sku" },
      { header: "Title", accessorKey: "title" },
      {
        header: "Type",
        accessorKey: "productType",
      },
      {
        header: "Status",
        cell: ({ row }) => <StatusChip status={row.original.status} />,
      },
      { header: "Brand", accessorKey: "brand" },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Products"
        description="Browse and manage the product catalog."
        actions={
          <button className="btn-primary" onClick={() => refetch()}>
            Refresh
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "REJECTED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={(error as Error).message} /> : null}
      {!isLoading && !error && data?.items.length === 0 ? (
        <EmptyState title="No products found" description="Adjust filters or create products via import." />
      ) : null}
      {!isLoading && !error && data && data.items.length > 0 ? (
        <>
          <DataTable
            data={data.items}
            columns={columns}
            onRowClick={(row) => router.push(`/admin/products/${row.id}`)}
          />
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
