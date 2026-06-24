"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Breadcrumb, PageHeader } from "@/components/layout/AdminShell";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/lib/session";

export default function MdmSourceRecordDetailPage() {
  const params = useParams<{ id: string }>();
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["mdm-source-record", params.id],
    queryFn: () => api.getMdmSourceRecord(params.id),
  });

  const resolveMutation = useMutation({
    mutationFn: (action: "link" | "ignore" | "create_new_product") =>
      api.resolveMdmMatch(params.id, {
        action,
        ...(action === "link" ? { productId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mdm-source-record", params.id] });
      queryClient.invalidateQueries({ queryKey: ["mdm-source-records"] });
    },
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "MDM", href: "/admin/mdm/source-records" },
          { label: "Source records", href: "/admin/mdm/source-records" },
          { label: data.sourceRecordId },
        ]}
      />
      <PageHeader
        title={`${data.sourceSystem} · ${data.sourceRecordId}`}
        description={`Status: ${data.status}`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold text-slate-900">Raw payload</h2>
          <pre className="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(data.rawPayloadJson, null, 2)}
          </pre>
        </section>

        <section className="card p-4">
          <h2 className="font-semibold text-slate-900">Match candidates</h2>
          {data.matchCandidates.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No candidates found.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.matchCandidates.map((candidate) => (
                <li key={candidate.id} className="rounded border border-slate-200 p-3 text-sm">
                  <p className="font-medium">{candidate.matchReason}</p>
                  <p className="text-slate-600">Score: {candidate.matchScore}</p>
                  <Link
                    href={`/admin/mdm/products/${candidate.candidateProductId}`}
                    className="text-brand-600 hover:underline"
                  >
                    View product
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.status === "UNMATCHED" || data.matchCandidates.length > 1 ? (
        <section className="card mt-6 p-4">
          <h2 className="font-semibold text-slate-900">Steward actions</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Link to product ID
              <input
                className="input mt-1 block w-72"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                placeholder="Product cuid"
              />
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={!productId || resolveMutation.isPending}
              onClick={() => resolveMutation.mutate("link")}
            >
              Link
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate("create_new_product")}
            >
              Create new product
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate("ignore")}
            >
              Ignore
            </button>
          </div>
        </section>
      ) : null}

      {data.productId ? (
        <p className="mt-4 text-sm">
          Matched product:{" "}
          <Link href={`/admin/mdm/products/${data.productId}`} className="text-brand-600 hover:underline">
            {data.productId}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
