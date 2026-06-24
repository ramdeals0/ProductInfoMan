"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatUserFacingError } from "@/lib/errors";
import { canApproveWorkflow, canEditProducts, canSubmitForReview } from "@/lib/roles";
import { useSession } from "@/lib/session";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const { api, user } = useSession();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const roles = user?.roles ?? [];
  const canEdit = canEditProducts(roles);
  const canSubmit = canSubmitForReview(roles);
  const canApprove = canApproveWorkflow(roles);

  const productQuery = useQuery({
    queryKey: ["product", params.id],
    queryFn: async () => {
      const product = await api.getProduct(params.id);
      setTitle(product.title);
      setBrand(product.brand ?? "");
      return product;
    },
  });

  const variantsQuery = useQuery({
    queryKey: ["variants", params.id],
    queryFn: () => api.listVariants(params.id),
    enabled: productQuery.data?.productType === "PARENT",
  });

  const historyQuery = useQuery({
    queryKey: ["workflow-history", params.id],
    queryFn: () => api.getWorkflowHistory(params.id),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.updateProduct(params.id, { title, brand }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["product", params.id] }),
  });

  const workflowMutation = useMutation({
    mutationFn: (action: "submit" | "approve" | "reject" | "publish") => {
      if (action === "submit") return api.submitProduct(params.id);
      if (action === "approve") return api.approveProduct(params.id);
      if (action === "publish") return api.publishProduct(params.id);
      return api.rejectProduct(params.id, { reason: rejectReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", params.id] });
      queryClient.invalidateQueries({ queryKey: ["workflow-history", params.id] });
    },
  });

  if (productQuery.isLoading) return <LoadingState />;
  if (productQuery.error) return <ErrorState message={formatUserFacingError(productQuery.error)} />;

  const product = productQuery.data!;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Products", href: "/admin/products" },
          { label: product.sku },
        ]}
      />
      <PageHeader
        title={product.title}
        description={`SKU ${product.sku} · ${product.productType}`}
        actions={<StatusChip status={product.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-5 lg:col-span-2">
          <h2 className="font-medium">Core data</h2>
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className="label">Brand</label>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} disabled={!canEdit} />
          </div>
          {canEdit ? (
          <button
            className="btn-primary"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            Save changes
          </button>
          ) : null}

          <div>
            <h3 className="mb-2 font-medium">Attributes</h3>
            <dl className="grid gap-2 sm:grid-cols-2">
              {product.attributes.map((attr) => (
                <div key={attr.key} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <dt className="text-slate-500">{attr.key}</dt>
                  <dd className="font-medium">{String(attr.value)}</dd>
                </div>
              ))}
            </dl>
          </div>

          {variantsQuery.data?.items.length ? (
            <div>
              <h3 className="mb-2 font-medium">Variants</h3>
              <ul className="space-y-2">
                {variantsQuery.data.items.map((variant) => (
                  <li key={variant.id}>
                    <Link
                      href={`/admin/products/${variant.id}`}
                      className="block rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {variant.sku} · <StatusChip status={variant.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="font-medium">Workflow</h2>
            <p className="mt-1 text-sm text-slate-600">
              Signed in as {user?.name || "User"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {canSubmit ? (
              <button className="btn-secondary" onClick={() => workflowMutation.mutate("submit")}>
                Submit
              </button>
              ) : null}
              {canApprove ? (
              <>
              <button className="btn-primary" onClick={() => workflowMutation.mutate("approve")}>
                Approve
              </button>
              <button className="btn-primary" onClick={() => workflowMutation.mutate("publish")}>
                Publish
              </button>
              </>
              ) : null}
            </div>
            {canApprove ? (
            <div className="mt-4">
              <label className="label">Reject reason (required)</label>
              <input
                className="input"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                minLength={1}
                placeholder="Explain why this product is rejected"
              />
              <button
                className="btn-danger mt-2"
                disabled={!rejectReason}
                onClick={() => workflowMutation.mutate("reject")}
              >
                Reject
              </button>
            </div>
            ) : null}
          </div>

          <div className="card p-5">
            <h2 className="font-medium">Workflow history</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(historyQuery.data?.items ?? []).map((entry) => (
                <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="font-medium">
                    {entry.fromState} → {entry.toState}
                  </div>
                  <div className="text-slate-500">{entry.actionType}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
