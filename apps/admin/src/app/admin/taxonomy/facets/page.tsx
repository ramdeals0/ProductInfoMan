"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { EditPanel } from "@/components/taxonomy/EditPanel";
import { PageHeader } from "@/components/layout/AdminShell";
import { DataTable } from "@/components/ui/DataTable";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import {
  canApproveFacetRules,
  canEditFacetRules,
  canManageTaxonomy,
} from "@/lib/roles";
import { useSession } from "@/lib/session";

type FacetRow = Record<string, unknown>;
type FacetRuleRow = Record<string, unknown>;

function summarizeRuleConfig(rule: FacetRuleRow): string {
  const config = rule.ruleConfig as Record<string, unknown> | null;
  if (!config) return "—";
  if (Array.isArray(config.buckets)) {
    return `${config.buckets.length} range bucket(s)`;
  }
  if (config.aliases) return "Normalize with aliases";
  if (config.trim || config.case) return `Normalize (${String(config.case ?? "trim")})`;
  return JSON.stringify(config).slice(0, 60);
}

export default function FacetsPage() {
  const { api, user } = useSession();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const roles = user?.roles ?? [];
  const canEditDefs = canManageTaxonomy(roles);
  const canEditRules = canEditFacetRules(roles);
  const canApproveRules = canApproveFacetRules(roles);

  const [selectedFacetId, setSelectedFacetId] = useState<string>("");
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

  const [newRuleType, setNewRuleType] = useState("DIRECT");
  const [newRuleConfig, setNewRuleConfig] = useState("");
  const [workflowNotes, setWorkflowNotes] = useState("");
  const [editingRule, setEditingRule] = useState<{
    id: string;
    ruleType: string;
    ruleConfig: string;
    priority: number;
  } | null>(null);

  const facetsQuery = useQuery({
    queryKey: ["facet-definitions"],
    queryFn: () => api.listFacetDefinitions({ includeInactive: true }),
  });
  const rulesQuery = useQuery({
    queryKey: ["facet-rules", selectedFacetId],
    queryFn: () =>
      api.listFacetRules(selectedFacetId ? { facetDefinitionId: selectedFacetId } : {}),
    enabled: canEditRules || canApproveRules,
  });
  const attributesQuery = useQuery({
    queryKey: ["attributes"],
    queryFn: () => api.listAttributes(),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories(),
  });

  const invalidateRules = () => {
    queryClient.invalidateQueries({ queryKey: ["facet-rules"] });
  };

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

  const createRuleMutation = useMutation({
    mutationFn: () => {
      let ruleConfig: Record<string, unknown> | null = null;
      if (newRuleConfig.trim()) {
        ruleConfig = JSON.parse(newRuleConfig) as Record<string, unknown>;
      }
      return api.createFacetRule({
        facetDefinitionId: selectedFacetId,
        ruleType: newRuleType,
        ...(ruleConfig ? { ruleConfig } : {}),
      });
    },
    onSuccess: () => {
      pushToast("Facet rule created (draft)", "success");
      setNewRuleType("DIRECT");
      setNewRuleConfig("");
      invalidateRules();
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const updateRuleMutation = useMutation({
    mutationFn: () => {
      let ruleConfig: Record<string, unknown> | null = null;
      if (editingRule!.ruleConfig.trim()) {
        ruleConfig = JSON.parse(editingRule!.ruleConfig) as Record<string, unknown>;
      }
      return api.updateFacetRule(editingRule!.id, {
        ruleType: editingRule!.ruleType,
        priority: editingRule!.priority,
        ruleConfig,
      });
    },
    onSuccess: () => {
      pushToast("Facet rule updated", "success");
      setEditingRule(null);
      invalidateRules();
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const workflowMutation = useMutation({
    mutationFn: (params: { id: string; action: string }) => {
      const body = workflowNotes ? { notes: workflowNotes } : {};
      switch (params.action) {
        case "submit":
          return api.submitFacetRule(params.id, body);
        case "approve":
          return api.approveFacetRule(params.id, body);
        case "reject":
          return api.rejectFacetRule(params.id, body);
        case "deprecate":
          return api.deprecateFacetRule(params.id, body);
        case "clone":
          return api.cloneFacetRule(params.id);
        default:
          throw new Error(`Unknown action: ${params.action}`);
      }
    },
    onSuccess: () => {
      pushToast("Facet rule workflow updated", "success");
      setWorkflowNotes("");
      invalidateRules();
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
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSelectedFacetId(String(row.original.id))}
            >
              Rules
            </button>
            {canEditDefs ? (
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
            ) : null}
          </div>
        ),
      },
    ],
    [canEditDefs],
  );

  const ruleColumns = useMemo<ColumnDef<FacetRuleRow>[]>(
    () => [
      { header: "Type", accessorKey: "ruleType" },
      {
        header: "Config",
        cell: ({ row }) => summarizeRuleConfig(row.original),
      },
      {
        header: "State",
        cell: ({ row }) => (
          <StatusChip status={String(row.original.workflowStateCode ?? "draft").toUpperCase()} />
        ),
      },
      { header: "Priority", accessorKey: "priority" },
      {
        header: "Updated",
        cell: ({ row }) => new Date(String(row.original.updatedAt)).toLocaleString(),
      },
      {
        header: "Actions",
        cell: ({ row }) => {
          const state = String(row.original.workflowStateCode ?? "draft");
          const id = String(row.original.id);
          return (
            <div className="flex flex-wrap gap-1">
              {canEditRules && state === "draft" ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() =>
                      setEditingRule({
                        id,
                        ruleType: String(row.original.ruleType),
                        ruleConfig: JSON.stringify(row.original.ruleConfig ?? {}, null, 2),
                        priority: Number(row.original.priority ?? 0),
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={workflowMutation.isPending}
                    onClick={() => workflowMutation.mutate({ id, action: "submit" })}
                  >
                    Submit
                  </button>
                </>
              ) : null}
              {canApproveRules && state === "in_review" ? (
                <>
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    disabled={workflowMutation.isPending}
                    onClick={() => workflowMutation.mutate({ id, action: "approve" })}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={workflowMutation.isPending}
                    onClick={() => workflowMutation.mutate({ id, action: "reject" })}
                  >
                    Reject
                  </button>
                </>
              ) : null}
              {canApproveRules && (state === "approved" || state === "in_review") ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={workflowMutation.isPending}
                  onClick={() => workflowMutation.mutate({ id, action: "deprecate" })}
                >
                  Deprecate
                </button>
              ) : null}
              {canEditRules && state === "deprecated" ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={workflowMutation.isPending}
                  onClick={() => workflowMutation.mutate({ id, action: "clone" })}
                >
                  Clone to draft
                </button>
              ) : null}
            </div>
          );
        },
      },
    ],
    [canEditRules, canApproveRules, workflowMutation],
  );

  const selectedFacet = (facetsQuery.data?.items ?? []).find((f) => f.id === selectedFacetId);

  return (
    <div>
      <PageHeader
        title="Facets"
        description="Manage facet definitions and review facet rules before they affect search."
      />

      {canEditDefs ? (
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
      ) : null}

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

      {editingRule ? (
        <EditPanel
          title="Edit facet rule (draft)"
          onClose={() => setEditingRule(null)}
          onSave={() => updateRuleMutation.mutate()}
          saving={updateRuleMutation.isPending}
        >
          <div className="grid gap-3">
            <div>
              <label className="label">Rule type</label>
              <select
                className="input"
                value={editingRule.ruleType}
                onChange={(e) => setEditingRule({ ...editingRule, ruleType: e.target.value })}
              >
                <option value="DIRECT">DIRECT</option>
                <option value="NORMALIZE">NORMALIZE</option>
                <option value="RANGE_BUCKET">RANGE_BUCKET</option>
                <option value="COMPOSITE">COMPOSITE</option>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <input
                className="input"
                type="number"
                value={editingRule.priority}
                onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Rule config (JSON)</label>
              <textarea
                className="input min-h-32 font-mono text-sm"
                value={editingRule.ruleConfig}
                onChange={(e) => setEditingRule({ ...editingRule, ruleConfig: e.target.value })}
              />
            </div>
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

      {selectedFacetId && (canEditRules || canApproveRules) ? (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">
              Rules for {selectedFacet ? String(selectedFacet.label) : selectedFacetId}
            </h2>
            <button type="button" className="btn-secondary text-sm" onClick={() => setSelectedFacetId("")}>
              Clear selection
            </button>
          </div>

          {(canEditRules || canApproveRules) && workflowNotes !== undefined ? (
            <div className="card p-4">
              <label className="label">Workflow notes (optional, used on submit/approve/reject)</label>
              <input
                className="input"
                placeholder="Reason for change…"
                value={workflowNotes}
                onChange={(e) => setWorkflowNotes(e.target.value)}
              />
            </div>
          ) : null}

          {canEditRules ? (
            <div className="card space-y-3 p-5">
              <h3 className="font-medium">Create facet rule (starts in draft)</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  className="input"
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value)}
                >
                  <option value="DIRECT">DIRECT</option>
                  <option value="NORMALIZE">NORMALIZE</option>
                  <option value="RANGE_BUCKET">RANGE_BUCKET</option>
                  <option value="COMPOSITE">COMPOSITE</option>
                </select>
                <textarea
                  className="input min-h-24 font-mono text-sm md:col-span-2"
                  placeholder='Rule config JSON, e.g. {"buckets":[...]}'
                  value={newRuleConfig}
                  onChange={(e) => setNewRuleConfig(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={!selectedFacetId || createRuleMutation.isPending}
                onClick={() => createRuleMutation.mutate()}
              >
                Create rule
              </button>
            </div>
          ) : null}

          {rulesQuery.data ? (
            <DataTable data={rulesQuery.data.items} columns={ruleColumns} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
