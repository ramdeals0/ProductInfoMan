"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { buildFacetSearchParams, getActiveFacetFilters, parseFacetFilters } from "@/lib/search-params";

export function ActiveFacetChips() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = getActiveFacetFilters(searchParams);

  if (active.length === 0) return null;

  const removeFilter = (key: string, value: string) => {
    const filters = parseFacetFilters(searchParams);
    const current = filters[key];
    const values = Array.isArray(current) ? current : current ? [current] : [];
    const updated = values.filter((entry) => entry !== value);
    if (updated.length === 0) {
      delete filters[key];
    } else {
      filters[key] = updated.length === 1 ? updated[0]! : updated;
    }
    const params = buildFacetSearchParams(searchParams, filters);
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [...params.keys()]) {
      if (key.startsWith("facet[")) params.delete(key);
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-brand-500">Active filters</span>
      {active.map((filter) => (
        <button
          key={`${filter.key}-${filter.value}`}
          type="button"
          onClick={() => removeFilter(filter.key, filter.value)}
          className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-white px-3 py-1 text-xs font-medium text-brand-800 transition hover:border-brand-500"
        >
          <span className="capitalize">{filter.key.replace(/_/g, " ")}</span>
          <span className="text-brand-400">:</span>
          <span>{filter.value.replace(/_/g, " ")}</span>
          <span aria-hidden className="text-brand-400">
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="text-xs font-semibold text-accent-600 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
