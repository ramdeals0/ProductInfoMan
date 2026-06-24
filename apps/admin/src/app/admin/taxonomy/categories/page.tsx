"use client";

import { useQuery } from "@tanstack/react-query";
import type { CategoryTreeNode } from "@productinfoman/domain";
import { PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { useSession } from "@/lib/session";

function CategoryNode({ node, depth = 0 }: { node: CategoryTreeNode; depth?: number }) {
  return (
    <div>
      <div
        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        style={{ marginLeft: depth * 16 }}
      >
        <div>
          <div className="font-medium">{node.name}</div>
          <div className="text-slate-500">
            {node.code} · {node.path}
          </div>
        </div>
        <StatusChip status={node.status} />
      </div>
      <div className="mt-2 space-y-2">
        {node.children.map((child) => (
          <CategoryNode key={child.id} node={child} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const { api } = useSession();
  const { data, isLoading, error } = useQuery({
    queryKey: ["category-tree"],
    queryFn: () => api.getCategoryTree(),
  });

  return (
    <div>
      <PageHeader title="Categories" description="Hierarchical category tree for the catalog." />
      {isLoading ? <LoadingState /> : null}
      {error ? <ErrorState message={(error as Error).message} /> : null}
      {data ? (
        <div className="space-y-3">
          {data.items.map((node) => (
            <CategoryNode key={node.id} node={node} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
