"use client";

import { useState } from "react";
import type { SearchFacetAggregationEntity } from "@productinfoman/domain";
import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { buildFacetSearchParams } from "@/lib/search-params";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={clsx("h-4 w-4 text-brand-500 transition", open ? "rotate-180" : "")}
      fill="currentColor"
      aria-hidden
    >
      <path d="M5.3 7.7a1 1 0 0 1 1.4 0L10 11l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

export function FacetSidebar({
  facets,
  className,
}: {
  facets: SearchFacetAggregationEntity[];
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleFacet = (key: string, value: string) => {
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

  const visibleFacets = facets.filter((facet) => facet.buckets.length > 0);
  if (visibleFacets.length === 0) return null;

  const toggleGroup = (key: string) => {
    setOpenGroups((current) => ({ ...current, [key]: !(current[key] ?? true) }));
  };

  return (
    <aside className={clsx("catalog-panel h-fit lg:sticky lg:top-36", className)}>
      <div className="border-b border-brand-200 bg-surface-muted px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-900">Refinements</h2>
      </div>
      <div>
        {visibleFacets.map((facet) => {
          const isOpen = openGroups[facet.key] ?? true;
          return (
            <div key={facet.key} className="refinement-group">
              <button
                type="button"
                className="refinement-trigger"
                onClick={() => toggleGroup(facet.key)}
                aria-expanded={isOpen}
              >
                <span className="capitalize">{facet.key.replace(/_/g, " ")}</span>
                <Chevron open={isOpen} />
              </button>
              {isOpen ? (
                <ul className="max-h-56 space-y-0.5 overflow-y-auto px-2 pb-3">
                  {facet.buckets.map((bucket) => {
                    const active = searchParams.getAll(`facet[${facet.key}]`).includes(bucket.value);
                    return (
                      <li key={bucket.value}>
                        <button
                          type="button"
                          onClick={() => toggleFacet(facet.key, bucket.value)}
                          className={clsx(
                            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition",
                            active
                              ? "bg-brand-800 font-medium text-white"
                              : "text-brand-700 hover:bg-brand-50",
                          )}
                        >
                          <span
                            className={clsx(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                              active ? "border-white bg-white text-brand-800" : "border-brand-300 bg-white",
                            )}
                          >
                            {active ? "✓" : ""}
                          </span>
                          <span className="flex-1 capitalize">{bucket.value.replace(/_/g, " ")}</span>
                          <span className={active ? "text-brand-200" : "text-brand-400"}>
                            ({bucket.count})
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
