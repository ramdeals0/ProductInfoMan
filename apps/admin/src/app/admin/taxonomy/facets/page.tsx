"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { EditPanel } from "@/components/taxonomy/EditPanel";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/session";

type FacetRow = Record<string, unknown>;

export default function FacetsPage() {
  const { api } = useSession();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{
    id: string;
    label: string;
    sortOrder: number;
    isDynamic: boolean;
    isActive: boolean;
    categoryId: string;
  } | null>(null);
  const [facetKey, setFacetKey] = useState("");
  const [facetLabel, setFacetLabel] = useState("");
  const [sourceAttributeId, setSourceAttributeId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const facetsQuery = useQuery({
    queryKey: ["facet-definitions"],
    queryFn: () => api.listFacetDefinitions({ includeInactive: true }),
  });
  const rulesQuery = useQuery({
    queryKey: ["facet-rules"],
    queryFn: () => api.listFacetRules(),
  });
  const attributesQuery = useQuery({
    queryKey: ["attributes"],
    queryFn: () => api.listAttributes(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories(),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateFacetDefinition(editing!.id, {
        label: editing!.label,
        sortOrder: editing!.sortOrder,
        isDynamic: editing!.isDynamic,
        isActive: editing!.isActive,
        categoryId: editing!.categoryId || null,
      }),
    onSuccess: () => {
      pushToast("Facet updated", "success");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["facet-definitions"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createFacetDefinition({
        key: facetKey,
        label: facetLabel,
        sourceAttributeId,
        ...(categoryId ? { categoryId } : {}),
      }),
    onSuccess: () => {
      pushToast("Facet created", "success");
      setFacetKey("");
      setFacetLabel("");
      setSourceAttributeId("");
      setCategoryId("");
      queryClient.invalidateQueries({ queryKey: ["facet-definitions"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const facetColumns = useMemo<ColumnDef<FacetRow>[]>(
    () => [
      { header: "Key", accessorKey: "key" },
      { header: "Label", accessorKey: "label" },
      { header: "Scope", accessorKey: "scope" },
      { header: "Source attribute", accessorKey: "sourceAttributeKey" },
      {
        header: "Active",
        cell: ({ row }) => (row.original.isActive ? "Yes" : "No"),
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setEditing({
                id: String(row.original.id),
                label: String(row.original.label),
                sortOrder: Number(row.original.sortOrder ?? 0),
                isDynamic: Boolean(row.original.isDynamic),
                isActive: Boolean(row.original.isActive),
                categoryId: String(row.original.categoryId ?? ""),
              })
            }
          >
            Edit
          </button>
        ),
      },
    ],
    [],
  );

  const ruleColumns = useMemo<ColumnDef<FacetRow>[]>(
    () => [
      { header: "Facet", accessorKey: "facetDefinitionId" },
      { header: "Rule type", accessorKey: "ruleType" },
      { header: "Priority", accessorKey: "priority" },
    ],
    [],
  );

  return (
    <div>
      <PageHeader title="Facets" description="Manage facet definitions for storefront filters." />

      <div className="card mb-6 space-y-3 p-5">
        <h2 className="font-medium">Create facet definition</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="input" placeholder="Key" value={facetKey} onChange={(e) => setFacetKey(e.target.value)} />
          <input
            className="input"
            placeholder="Label"
            value={facetLabel}
            onChange={(e) => setFacetLabel(e.target.value)}
          />
          <select
            className="input"
            value={sourceAttributeId}
            onChange={(e) => setSourceAttributeId(e.target.value)}
          >
            <option value="">Source attribute</option>
            {(attributesQuery.data?.items ?? []).map((attr) => (
              <option key={String(attr.id)} value={String(attr.id)}>
                {String(attr.key)} — {String(attr.label)}
              </option>
            ))}
          </select>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Global (all categories)</option>
            {(categoriesQuery.data?.items ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.code})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!facetKey || !facetLabel || !sourceAttributeId || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create facet
        </button>
      </div>

      {editing ? (
        <EditPanel
          title="Edit facet definition"
          onClose={() => setEditing(null)}
          onSave={() => updateMutation.mutate()}
          saving={updateMutation.isPending}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Label</label>
              <input
                className="input"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Sort order</label>
              <input
                className="input"
                type="number"
                value={editing.sortOrder}
                onChange={(e) => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Category scope</label>
              <select
                className="input"
                value={editing.categoryId}
                onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
              >
                <option value="">Global</option>
                {(categoriesQuery.data?.items ?? []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.isDynamic}
                onChange={(e) => setEditing({ ...editing, isDynamic: e.target.checked })}
              />
              Dynamic values
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
              />
              Active on storefront
            </label>
          </div>
        </EditPanel>
      ) : null}

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
