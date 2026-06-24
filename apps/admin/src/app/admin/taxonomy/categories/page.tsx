"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CategoryTreeNode } from "@productinfoman/domain";
import { InlineEditForm } from "@/components/taxonomy/EditPanel";
import { PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/session";
import {
  isValidCategorySlug,
  normalizeCategorySlug,
  slugFromName,
} from "@/lib/taxonomy-keys";

type EditState = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  status: string;
  isActive: boolean;
};

function CategoryNode({
  node,
  depth = 0,
  editing,
  onEdit,
  onCloseEdit,
  onSaveEdit,
  saving,
  onEditingChange,
}: {
  node: CategoryTreeNode;
  depth?: number;
  editing: EditState | null;
  onEdit: (node: CategoryTreeNode) => void;
  onCloseEdit: () => void;
  onSaveEdit: () => void;
  saving: boolean;
  onEditingChange: (next: EditState) => void;
}) {
  const isEditing = editing?.id === node.id;

  return (
    <div>
      <div
        className="rounded-lg border border-slate-200 bg-white text-sm"
        style={{ marginLeft: depth * 16 }}
      >
        {isEditing && editing ? (
          <div className="p-3">
            <InlineEditForm onClose={onCloseEdit} onSave={onSaveEdit} saving={saving}>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={editing.name}
                    onChange={(e) => onEditingChange({ ...editing, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Slug</label>
                  <input
                    className="input"
                    value={editing.slug}
                    onChange={(e) => onEditingChange({ ...editing, slug: e.target.value })}
                    onBlur={() =>
                      onEditingChange({
                        ...editing,
                        slug: normalizeCategorySlug(editing.slug),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label">Sort order</label>
                  <input
                    className="input"
                    type="number"
                    value={editing.sortOrder}
                    onChange={(e) =>
                      onEditingChange({ ...editing, sortOrder: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={editing.status}
                    onChange={(e) => onEditingChange({ ...editing, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input
                    type="checkbox"
                    checked={editing.isActive}
                    onChange={(e) => onEditingChange({ ...editing, isActive: e.target.checked })}
                  />
                  Active in catalog
                </label>
              </div>
            </InlineEditForm>
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-2">
            <div>
              <div className="font-medium">{node.name}</div>
              <div className="text-slate-500">
                {node.code} · {node.path}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip status={node.status} />
              <button type="button" className="btn-secondary" onClick={() => onEdit(node)}>
                Edit
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {node.children.map((child) => (
          <CategoryNode
            key={child.id}
            node={child}
            depth={depth + 1}
            editing={editing}
            onEdit={onEdit}
            onCloseEdit={onCloseEdit}
            onSaveEdit={onSaveEdit}
            saving={saving}
            onEditingChange={onEditingChange}
          />
        ))}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const { api } = useSession();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createParentId, setCreateParentId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["category-tree"],
    queryFn: () => api.getCategoryTree(),
  });

  const flatCategoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories(),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const slug = normalizeCategorySlug(editing!.slug);
      if (!isValidCategorySlug(slug)) {
        throw new Error("Enter a valid slug using letters, numbers, or hyphens (e.g. mens-shirts)");
      }
      return api.updateCategory(editing!.id, {
        name: editing!.name,
        slug,
        sortOrder: editing!.sortOrder,
        status: editing!.status,
        isActive: editing!.isActive,
      });
    },
    onSuccess: () => {
      pushToast("Category updated", "success");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["category-tree"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const slug = normalizeCategorySlug(createSlug || createName);
      if (!isValidCategorySlug(slug)) {
        throw new Error("Enter a valid slug using letters, numbers, or hyphens (e.g. mens-shirts)");
      }
      return api.createCategory({
        name: createName,
        slug,
        ...(createParentId ? { parentId: createParentId } : {}),
      });
    },
    onSuccess: () => {
      pushToast("Category created", "success");
      setCreateName("");
      setCreateSlug("");
      setCreateParentId("");
      queryClient.invalidateQueries({ queryKey: ["category-tree"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err) => pushToast((err as Error).message, "error"),
  });

  return (
    <div>
      <PageHeader title="Categories" description="Manage the hierarchical category tree." />

      <div className="card mb-6 space-y-3 p-5">
        <h2 className="font-medium">Create category</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="input"
            placeholder="Name"
            value={createName}
            onChange={(e) => {
              const name = e.target.value;
              setCreateName(name);
              if (!createSlug) setCreateSlug(slugFromName(name));
            }}
          />
          <input
            className="input"
            placeholder="Slug (e.g. mens-shirts)"
            value={createSlug}
            onChange={(e) => setCreateSlug(e.target.value)}
            onBlur={() => setCreateSlug((current) => normalizeCategorySlug(current || createName))}
          />
          <select
            className="input"
            value={createParentId}
            onChange={(e) => setCreateParentId(e.target.value)}
          >
            <option value="">No parent (root)</option>
            {(flatCategoriesQuery.data?.items ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.code})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={createMutation.isPending || !createName || (!createSlug && !createName)}
          onClick={() => createMutation.mutate()}
        >
          Create category
        </button>
      </div>

      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={(error as Error).message} /> : null}
      {data ? (
        <div className="space-y-3">
          {data.items.map((node) => (
            <CategoryNode
              key={node.id}
              node={node}
              editing={editing}
              onEdit={(category) =>
                setEditing({
                  id: category.id,
                  name: category.name,
                  slug: category.slug,
                  sortOrder: category.sortOrder,
                  status: category.status,
                  isActive: category.isActive,
                })
              }
              onCloseEdit={() => setEditing(null)}
              onSaveEdit={() => updateMutation.mutate()}
              saving={updateMutation.isPending}
              onEditingChange={setEditing}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
