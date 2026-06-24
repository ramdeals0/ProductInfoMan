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

type AttributeRow = Record<string, unknown>;
type GroupRow = Record<string, unknown>;

export default function AttributesPage() {
  const { api } = useSession();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [editingGroup, setEditingGroup] = useState<{
    id: string;
    name: string;
    description: string;
    sortOrder: number;
  } | null>(null);
  const [editingAttribute, setEditingAttribute] = useState<{
    id: string;
    label: string;
    description: string;
    isGlobal: boolean;
    isVariantAxis: boolean;
    isRequired: boolean;
    isFilterable: boolean;
    isSearchable: boolean;
  } | null>(null);
  const [groupName, setGroupName] = useState("");
  const [attrKey, setAttrKey] = useState("");
  const [attrLabel, setAttrLabel] = useState("");
  const [attrGroupId, setAttrGroupId] = useState("");
  const [attrDataType, setAttrDataType] = useState("TEXT");

  const groupsQuery = useQuery({
    queryKey: ["attribute-groups"],
    queryFn: () => api.listAttributeGroups(),
  });
  const attributesQuery = useQuery({
    queryKey: ["attributes"],
    queryFn: () => api.listAttributes(),
  });

  const updateGroupMutation = useMutation({
    mutationFn: () =>
      api.updateAttributeGroup(editingGroup!.id, {
        name: editingGroup!.name,
        description: editingGroup!.description || null,
        sortOrder: editingGroup!.sortOrder,
      }),
    onSuccess: () => {
      pushToast("Attribute group updated", "success");
      setEditingGroup(null);
      queryClient.invalidateQueries({ queryKey: ["attribute-groups"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const updateAttributeMutation = useMutation({
    mutationFn: () =>
      api.updateAttribute(editingAttribute!.id, {
        label: editingAttribute!.label,
        description: editingAttribute!.description || null,
        isGlobal: editingAttribute!.isGlobal,
        isVariantAxis: editingAttribute!.isVariantAxis,
        isRequired: editingAttribute!.isRequired,
        isFilterable: editingAttribute!.isFilterable,
        isSearchable: editingAttribute!.isSearchable,
      }),
    onSuccess: () => {
      pushToast("Attribute updated", "success");
      setEditingAttribute(null);
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const createGroupMutation = useMutation({
    mutationFn: () => api.createAttributeGroup({ name: groupName }),
    onSuccess: () => {
      pushToast("Attribute group created", "success");
      setGroupName("");
      queryClient.invalidateQueries({ queryKey: ["attribute-groups"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const createAttributeMutation = useMutation({
    mutationFn: () =>
      api.createAttribute({
        attributeGroupId: attrGroupId,
        key: attrKey,
        label: attrLabel,
        dataType: attrDataType,
      }),
    onSuccess: () => {
      pushToast("Attribute created", "success");
      setAttrKey("");
      setAttrLabel("");
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
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
      {
        header: "Actions",
        cell: ({ row }) => (
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setEditingAttribute({
                id: String(row.original.id),
                label: String(row.original.label),
                description: String(row.original.description ?? ""),
                isGlobal: Boolean(row.original.isGlobal),
                isVariantAxis: Boolean(row.original.isVariantAxis),
                isRequired: Boolean(row.original.isRequired),
                isFilterable: Boolean(row.original.isFilterable),
                isSearchable: Boolean(row.original.isSearchable),
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

  return (
    <div>
      <PageHeader title="Attributes" description="Manage attribute groups and definitions." />

      <div className="card mb-6 grid gap-6 p-5 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-medium">Create attribute group</h2>
          <input
            className="input"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!groupName || createGroupMutation.isPending}
            onClick={() => createGroupMutation.mutate()}
          >
            Create group
          </button>
        </div>
        <div className="space-y-3">
          <h2 className="font-medium">Create attribute</h2>
          <select className="input" value={attrGroupId} onChange={(e) => setAttrGroupId(e.target.value)}>
            <option value="">Select group</option>
            {(groupsQuery.data?.items ?? []).map((group) => (
              <option key={String(group.id)} value={String(group.id)}>
                {String(group.name)}
              </option>
            ))}
          </select>
          <input className="input" placeholder="Key" value={attrKey} onChange={(e) => setAttrKey(e.target.value)} />
          <input
            className="input"
            placeholder="Label"
            value={attrLabel}
            onChange={(e) => setAttrLabel(e.target.value)}
          />
          <select className="input" value={attrDataType} onChange={(e) => setAttrDataType(e.target.value)}>
            <option value="TEXT">TEXT</option>
            <option value="ENUM">ENUM</option>
            <option value="NUMBER">NUMBER</option>
            <option value="BOOLEAN">BOOLEAN</option>
          </select>
          <button
            type="button"
            className="btn-primary"
            disabled={!attrGroupId || !attrKey || !attrLabel || createAttributeMutation.isPending}
            onClick={() => createAttributeMutation.mutate()}
          >
            Create attribute
          </button>
        </div>
      </div>

      {editingGroup ? (
        <EditPanel
          title="Edit attribute group"
          onClose={() => setEditingGroup(null)}
          onSave={() => updateGroupMutation.mutate()}
          saving={updateGroupMutation.isPending}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={editingGroup.name}
                onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Sort order</label>
              <input
                className="input"
                type="number"
                value={editingGroup.sortOrder}
                onChange={(e) => setEditingGroup({ ...editingGroup, sortOrder: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <input
                className="input"
                value={editingGroup.description}
                onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
              />
            </div>
          </div>
        </EditPanel>
      ) : null}

      {editingAttribute ? (
        <EditPanel
          title="Edit attribute"
          onClose={() => setEditingAttribute(null)}
          onSave={() => updateAttributeMutation.mutate()}
          saving={updateAttributeMutation.isPending}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Label</label>
              <input
                className="input"
                value={editingAttribute.label}
                onChange={(e) => setEditingAttribute({ ...editingAttribute, label: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={editingAttribute.description}
                onChange={(e) => setEditingAttribute({ ...editingAttribute, description: e.target.value })}
              />
            </div>
            {(
              [
                ["isGlobal", "Global"],
                ["isVariantAxis", "Variant axis"],
                ["isRequired", "Required"],
                ["isFilterable", "Filterable"],
                ["isSearchable", "Searchable"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingAttribute[key]}
                  onChange={(e) => setEditingAttribute({ ...editingAttribute, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </EditPanel>
      ) : null}

      {groupsQuery.isLoading || attributesQuery.isLoading ? <LoadingState /> : null}
      {groupsQuery.error ? <ErrorState message={(groupsQuery.error as Error).message} /> : null}
      {groupsQuery.data ? (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {groupsQuery.data.items.map((group: GroupRow) => (
            <div key={String(group.id)} className="card p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{String(group.name)}</div>
                  <div className="text-slate-500">{String(group.code)}</div>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setEditingGroup({
                      id: String(group.id),
                      name: String(group.name),
                      description: String(group.description ?? ""),
                      sortOrder: Number(group.sortOrder ?? 0),
                    })
                  }
                >
                  Edit
                </button>
              </div>
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
