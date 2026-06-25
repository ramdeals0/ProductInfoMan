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

  const visibleFacets = facets.filter((facet) => facet.buckets.length > 0);
  if (visibleFacets.length === 0) return null;

  return (
    <aside className="card h-fit p-5 md:sticky md:top-28">
      <h2 className="font-display text-lg text-brand-900">Filter by</h2>
      <div className="mt-5 space-y-6">
        {visibleFacets.map((facet) => (
          <div key={facet.key}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-500">
              {facet.key.replace(/_/g, " ")}
            </h3>
            <ul className="mt-2.5 space-y-1">
              {facet.buckets.map((bucket) => {
                const active = searchParams.getAll(`facet[${facet.key}]`).includes(bucket.value);
                return (
                  <li key={bucket.value}>
                    <button
                      type="button"
                      onClick={() => toggleFacet(facet.key, bucket.value)}
                      className={clsx(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                        active
                          ? "bg-brand-800 font-medium text-white"
                          : "text-brand-700 hover:bg-brand-50",
                      )}
                    >
                      <span>{bucket.value}</span>
                      <span className={active ? "text-brand-200" : "text-brand-400"}>
                        {bucket.count}
                      </span>
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
