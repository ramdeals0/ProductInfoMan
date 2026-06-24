"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/lib/session";

type FacetRow = Record<string, unknown>;

export default function FacetsPage() {
  const { api } = useSession();
  const facetsQuery = useQuery({
    queryKey: ["facet-definitions"],
    queryFn: () => api.listFacetDefinitions(),
  });
  const rulesQuery = useQuery({
    queryKey: ["facet-rules"],
    queryFn: () => api.listFacetRules(),
  });

  const facetColumns = useMemo<ColumnDef<FacetRow>[]>(
    () => [
      { header: "Key", accessorKey: "key" },
      { header: "Label", accessorKey: "label" },
      { header: "Scope", accessorKey: "scope" },
      { header: "Source attribute", accessorKey: "sourceAttributeKey" },
    ],
    [],
  );

  const ruleColumns = useMemo<ColumnDef<FacetRow>[]>(
    () => [
      {
        header: "Facet",
        cell: ({ row }) => {
          const label = row.original.facetLabel;
          const key = row.original.facetKey;
          if (typeof label === "string" && label) return label;
          if (typeof key === "string" && key) return key;
          return String(row.original.facetDefinitionId ?? "—");
        },
      },
      { header: "Rule type", accessorKey: "ruleType" },
      { header: "Priority", accessorKey: "priority" },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Facets" description="Facet definitions and transformation rules." />
      {facetsQuery.isLoading ? <LoadingState /> : null}
      {facetsQuery.error ? <ErrorState message={(facetsQuery.error as Error).message} /> : null}
      {facetsQuery.data ? (
        <>
          <h2 className="mb-3 font-medium">Definitions</h2>
          <DataTable data={facetsQuery.data.items} columns={facetColumns} />
        </>
      ) : null}
      {rulesQuery.data ? (
        <div className="mt-8">
          <h2 className="mb-3 font-medium">Rules</h2>
          <DataTable data={rulesQuery.data.items} columns={ruleColumns} />
        </div>
      ) : null}
    </div>
  );
}
