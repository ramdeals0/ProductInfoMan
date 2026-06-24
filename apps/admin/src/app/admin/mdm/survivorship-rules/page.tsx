"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { SurvivorshipRuleEntity } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/lib/session";

export default function SurvivorshipRulesPage() {
  const { api } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["mdm-survivorship-rules"],
    queryFn: () => api.listSurvivorshipRules(),
  });

  const columns = useMemo<ColumnDef<SurvivorshipRuleEntity>[]>(
    () => [
      { header: "Code", accessorKey: "code" },
      { header: "Name", accessorKey: "name" },
      { header: "Attribute", accessorKey: "attributeCode" },
      { header: "Rule type", accessorKey: "ruleType" },
      {
        header: "Active",
        cell: ({ row }) => (row.original.isActive ? "Yes" : "No"),
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Survivorship rules"
        description="Configure which upstream source wins for each master attribute."
      />
      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={(error as Error).message} /> : null}
      {!isLoading && !error && data?.items.length === 0 ? (
        <EmptyState title="No survivorship rules" description="Seed or create rules via the MDM API." />
      ) : null}
      {data?.items.length ? <DataTable data={data.items} columns={columns} /> : null}
    </div>
  );
}
