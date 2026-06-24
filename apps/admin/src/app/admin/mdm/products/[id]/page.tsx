"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/lib/session";

export default function MdmProductPage() {
  const params = useParams<{ id: string }>();
  const { api } = useSession();

  const productQuery = useQuery({
    queryKey: ["product", params.id],
    queryFn: () => api.getProduct(params.id),
  });

  const systemsQuery = useQuery({
    queryKey: ["mdm-system-ids", params.id],
    queryFn: () => api.listProductSystemIds(params.id),
  });

  const auditQuery = useQuery({
    queryKey: ["audit", params.id],
    queryFn: () => api.listAudit({ productId: params.id, page: 1, pageSize: 10 }),
  });

  if (productQuery.isLoading) return <LoadingState />;
  if (productQuery.error) return <ErrorState message={(productQuery.error as Error).message} />;
  if (!productQuery.data) return null;

  const product = productQuery.data;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Products", href: "/admin/products" },
          { label: product.title, href: `/admin/products/${product.id}` },
          { label: "MDM" },
        ]}
      />
      <PageHeader
        title={`MDM · ${product.title}`}
        description="Golden record view with linked system identifiers."
      />

      <section className="card mb-6 p-4">
        <h2 className="font-semibold text-slate-900">Master summary</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">SKU</dt>
            <dd>{product.sku}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Brand</dt>
            <dd>{product.brand ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd>{product.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">PIM record</dt>
            <dd>
              <Link href={`/admin/products/${product.id}`} className="text-brand-600 hover:underline">
                Open in catalog
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      <section className="card mb-6 p-4">
        <h2 className="font-semibold text-slate-900">Linked system IDs</h2>
        {systemsQuery.isLoading ? <LoadingState /> : null}
        {systemsQuery.data?.items.length ? (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">System</th>
                <th className="py-2">External key</th>
                <th className="py-2">Primary</th>
              </tr>
            </thead>
            <tbody>
              {systemsQuery.data.items.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100">
                  <td className="py-2">{entry.systemCode}</td>
                  <td className="py-2">{entry.externalKey}</td>
                  <td className="py-2">{entry.isPrimary ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No external system mappings yet.</p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold text-slate-900">Recent MDM audit activity</h2>
        {auditQuery.data?.items.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {auditQuery.data.items.map((entry) => (
              <li key={entry.id} className="rounded border border-slate-200 p-3">
                <p className="font-medium">{entry.action}</p>
                <p className="text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No recent audit entries for this product.</p>
        )}
      </section>
    </div>
  );
}
