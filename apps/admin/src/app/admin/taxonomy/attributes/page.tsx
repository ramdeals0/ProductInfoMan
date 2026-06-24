"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/lib/session";

type AttributeRow = Record<string, unknown>;

export default function AttributesPage() {
  const { api } = useSession();
  const groupsQuery = useQuery({
    queryKey: ["attribute-groups"],
    queryFn: () => api.listAttributeGroups(),
  });
  const attributesQuery = useQuery({
    queryKey: ["attributes"],
    queryFn: () => api.listAttributes(),
  });

  const columns = useMemo<ColumnDef<AttributeRow>[]>(
    () => [
      { header: "Key", accessorKey: "key" },
      { header: "Label", accessorKey: "label" },
      { header: "Type", accessorKey: "dataType" },
      {
        header: "Filterable",
        cell: ({ row }) => (row.original.isFilterable ? "Yes" : "No"),
      },
      {
        header: "Variant axis",
        cell: ({ row }) => (row.original.isVariantAxis ? "Yes" : "No"),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Attributes" description="Attribute groups and definitions." />
      {groupsQuery.isLoading || attributesQuery.isLoading ? <LoadingState /> : null}
      {groupsQuery.error ? <ErrorState message={(groupsQuery.error as Error).message} /> : null}
      {groupsQuery.data ? (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {groupsQuery.data.items.map((group) => (
            <div key={String(group.id)} className="card p-4 text-sm">
              <div className="font-medium">{String(group.name)}</div>
              <div className="text-slate-500">{String(group.code)}</div>
            </div>
          ))}
        </div>
      ) : null}
      {attributesQuery.data ? (
        <DataTable data={attributesQuery.data.items} columns={columns} />
      ) : null}
    </div>
  );
}
