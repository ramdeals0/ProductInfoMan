"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CategoryEntity } from "@productinfoman/domain";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatUserFacingError } from "@/lib/errors";
import { canApproveWorkflow, canEditProducts, canSubmitForReview } from "@/lib/roles";
import { useSession } from "@/lib/session";

function formatAttributeValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseAttributeInput(raw: string, existing: unknown): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (typeof existing === "number") {
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? trimmed : parsed;
  }
  if (typeof existing === "boolean") {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
  }
  return trimmed;
}

function formatCategoryPath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .join(" / ");
}

function sortCategories(categories: CategoryEntity[]): CategoryEntity[] {
  return [...categories].sort((left, right) => left.path.localeCompare(right.path));
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const { api, user } = useSession();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [summary, setSummary] = useState("");
  const [sellingPointsText, setSellingPointsText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [discontinueDate, setDiscontinueDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [attributeEdits, setAttributeEdits] = useState<Record<string, string>>({});
  const [primaryCategoryId, setPrimaryCategoryId] = useState("");

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
      setSummary(product.summary ?? "");
      setSellingPointsText((product.sellingPoints ?? []).join("\n"));
      setStartDate(product.startDate ? product.startDate.slice(0, 10) : "");
      setDiscontinueDate(product.discontinueDate ? product.discontinueDate.slice(0, 10) : "");
      setPrimaryCategoryId(product.primaryCategoryId ?? "");
      return product;
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories(),
  });

  const facetsQuery = useQuery({
    queryKey: ["product-facets", params.id],
    queryFn: () => api.getProductFacets(params.id),
    enabled: Boolean(productQuery.data),
  });

  useEffect(() => {
    if (!productQuery.data) return;
    const next: Record<string, string> = {};
    for (const attr of productQuery.data.attributes) {
      next[attr.key] = formatAttributeValue(attr.value);
    }
    setAttributeEdits(next);
  }, [productQuery.data]);

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
    mutationFn: () =>
      api.updateProduct(params.id, {
        title,
        brand,
        summary: summary || null,
        sellingPoints: sellingPointsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 10),
        startDate: startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : null,
        discontinueDate: discontinueDate
          ? new Date(`${discontinueDate}T00:00:00.000Z`).toISOString()
          : null,
        primaryCategoryId: primaryCategoryId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", params.id] });
      queryClient.invalidateQueries({ queryKey: ["product-facets", params.id] });
    },
  });

  const attributesMutation = useMutation({
    mutationFn: () => {
      const product = productQuery.data;
      if (!product) throw new Error("Product not loaded");

      const existingByKey = new Map(product.attributes.map((attr) => [attr.key, attr]));
      const attributes: Record<string, unknown> = {};

      for (const [key, edited] of Object.entries(attributeEdits)) {
        if (edited === undefined) continue;
        const existing = existingByKey.get(key);
        const parsed = parseAttributeInput(edited, existing?.value ?? null);
        if (!existing || JSON.stringify(parsed) !== JSON.stringify(existing.value)) {
          attributes[key] = parsed;
        }
      }

      return api.setProductAttributes(params.id, attributes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", params.id] });
      queryClient.invalidateQueries({ queryKey: ["product-facets", params.id] });
    },
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
      queryClient.invalidateQueries({ queryKey: ["product-facets", params.id] });
      queryClient.invalidateQueries({ queryKey: ["workflow-history", params.id] });
    },
  });

  if (productQuery.isLoading) return <LoadingState />;
  if (productQuery.error) return <ErrorState message={formatUserFacingError(productQuery.error)} />;

  const product = productQuery.data!;
  const facets = facetsQuery.data?.facets ?? [];
  const facetSourceKeys = new Set(facets.map((facet) => facet.sourceAttributeKey));
  const categories = sortCategories(categoriesQuery.data?.items ?? []);
  const selectedCategory = categories.find((category) => category.id === primaryCategoryId) ?? null;

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
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="label mb-0" htmlFor="primary-category">
                Primary category
              </label>
              <Link href="/admin/taxonomy/categories" className="text-xs text-sky-700 hover:underline">
                Manage categories
              </Link>
            </div>
            {canEdit ? (
              <select
                id="primary-category"
                className="input"
                value={primaryCategoryId}
                onChange={(e) => setPrimaryCategoryId(e.target.value)}
              >
                <option value="">No category</option>
                {categories
                  .filter((category) => category.isActive)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {`${"— ".repeat(category.depth)}${category.name} (${category.code})`}
                    </option>
                  ))}
              </select>
            ) : (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                {selectedCategory
                  ? `${selectedCategory.name} · ${formatCategoryPath(selectedCategory.path)}`
                  : "No category assigned"}
              </p>
            )}
            {selectedCategory ? (
              <p className="mt-1 text-xs text-slate-500">{formatCategoryPath(selectedCategory.path)}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Category drives which attributes and storefront facets apply to this product.
              </p>
            )}
          </div>
          <div>
            <label className="label">Summary (~20 words)</label>
            <textarea
              className="input min-h-20"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="label">Selling points (one per line, up to 10)</label>
            <textarea
              className="input min-h-48 font-mono text-sm"
              value={sellingPointsText}
              onChange={(e) => setSellingPointsText(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Start date (storefront activation)</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="label">Discontinue date (storefront deactivation)</label>
              <input
                type="date"
                className="input"
                value={discontinueDate}
                onChange={(e) => setDiscontinueDate(e.target.value)}
                disabled={!canEdit}
              />
            </div>
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
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-medium">Attributes</h3>
              {facetSourceKeys.size > 0 ? (
                <span className="text-xs text-slate-500">Highlighted rows drive storefront facets</span>
              ) : null}
            </div>
            {product.attributes.length === 0 ? (
              <p className="text-sm text-slate-500">No attributes on this product.</p>
            ) : (
              <div className="space-y-2">
                {product.attributes.map((attr) => (
                  <div
                    key={attr.key}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      facetSourceKeys.has(attr.key) ? "border border-sky-200 bg-sky-50" : "bg-slate-50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="font-medium text-slate-700" htmlFor={`attr-${attr.key}`}>
                        {attr.key}
                      </label>
                      <span className="text-xs text-slate-400">{attr.source}</span>
                    </div>
                    <input
                      id={`attr-${attr.key}`}
                      className="input"
                      value={attributeEdits[attr.key] ?? ""}
                      onChange={(e) =>
                        setAttributeEdits((current) => ({ ...current, [attr.key]: e.target.value }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                ))}
              </div>
            )}
            {canEdit && product.attributes.length > 0 ? (
              <button
                className="btn-secondary mt-3"
                disabled={attributesMutation.isPending}
                onClick={() => attributesMutation.mutate()}
              >
                Save attributes
              </button>
            ) : null}
            {attributesMutation.error ? (
              <p className="mt-2 text-sm text-red-600">{formatUserFacingError(attributesMutation.error)}</p>
            ) : null}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-medium">Storefront facets</h3>
              <Link href="/admin/taxonomy/facets" className="text-sm text-sky-700 hover:underline">
                Manage facet rules
              </Link>
            </div>
            {facetsQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading facet preview…</p>
            ) : facetsQuery.error ? (
              <p className="text-sm text-red-600">{formatUserFacingError(facetsQuery.error)}</p>
            ) : facets.length === 0 ? (
              <p className="text-sm text-slate-500">
                No facets apply to this product&apos;s category. Assign a primary category or configure facets in
                taxonomy.
              </p>
            ) : (
              <>
                {facetsQuery.data && !facetsQuery.data.isIndexable ? (
                  <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Preview only — facets appear in search after the product is approved.
                  </p>
                ) : null}
                <dl className="grid gap-2 sm:grid-cols-2">
                  {facets.map((facet) => (
                    <div key={facet.key} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <dt className="text-slate-500">{facet.label}</dt>
                      <dd className="font-medium">{facet.displayValue ?? facet.computedValue ?? "—"}</dd>
                      <dd className="mt-1 text-xs text-slate-400">
                        {facet.sourceAttributeKey}: {formatAttributeValue(facet.rawValue) || "—"}
                        {facet.ruleType ? ` · ${facet.ruleType}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
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
