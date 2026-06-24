"use client";

import type { SearchFacetAggregationEntity } from "@productinfoman/domain";
import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { buildFacetSearchParams } from "@/lib/search-params";

export function FacetSidebar({ facets }: { facets: SearchFacetAggregationEntity[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleFacet = (key: string, value: string) => {
    const currentKey = `facet[${key}]`;
    const active = searchParams.getAll(currentKey);
    const nextFilters: Record<string, string | string[]> = {};

    for (const facet of facets) {
      const values = searchParams.getAll(`facet[${facet.key}]`);
      if (values.length) nextFilters[facet.key] = values;
    }

    const current = nextFilters[key];
    const values = Array.isArray(current) ? current : current ? [current] : [];
    const updated = values.includes(value)
      ? values.filter((entry) => entry !== value)
      : [...values, value];

    if (updated.length === 0) {
      delete nextFilters[key];
    } else {
      nextFilters[key] = updated.length === 1 ? updated[0]! : updated;
    }

    const params = buildFacetSearchParams(searchParams, nextFilters);
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  if (facets.length === 0) return null;

  return (
    <aside className="card p-4">
      <h2 className="font-semibold text-slate-900">Filters</h2>
      <div className="mt-4 space-y-6">
        {facets.map((facet) => (
          <div key={facet.key}>
            <h3 className="text-sm font-medium capitalize text-slate-700">{facet.key}</h3>
            <ul className="mt-2 space-y-1">
              {facet.buckets.map((bucket) => {
                const active = searchParams.getAll(`facet[${facet.key}]`).includes(bucket.value);
                return (
                  <li key={bucket.value}>
                    <button
                      type="button"
                      onClick={() => toggleFacet(facet.key, bucket.value)}
                      className={clsx(
                        "flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm",
                        active ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50",
                      )}
                    >
                      <span>{bucket.value}</span>
                      <span className="text-slate-400">{bucket.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
