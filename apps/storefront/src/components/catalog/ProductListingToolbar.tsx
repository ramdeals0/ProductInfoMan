"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  getListingView,
  PAGE_SIZE_OPTIONS,
  SORT_OPTIONS,
  type ListingView,
} from "@/lib/search-params";

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
      <rect x="2" y="2" width="7" height="7" rx="1" />
      <rect x="11" y="2" width="7" height="7" rx="1" />
      <rect x="2" y="11" width="7" height="7" rx="1" />
      <rect x="11" y="11" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
      <rect x="2" y="3" width="16" height="3" rx="1" />
      <rect x="2" y="8.5" width="16" height="3" rx="1" />
      <rect x="2" y="14" width="16" height="3" rx="1" />
    </svg>
  );
}

export function ProductListingToolbar({ total }: { total: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = getListingView(searchParams);
  const sort = searchParams.get("sort") ?? "relevance";
  const pageSize = searchParams.get("pageSize") ?? "24";

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (!updates.page) params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  const setView = (nextView: ListingView) => updateParams({ view: nextView === "grid" ? null : nextView });

  return (
    <div className="catalog-toolbar">
      <p className="text-sm text-brand-700">
        <span className="font-semibold text-brand-900">{total.toLocaleString()}</span> items
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-brand-700">
          <span className="hidden sm:inline">Sort by</span>
          <select
            className="input w-auto min-w-[10rem] py-2"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value === "relevance" ? null : event.target.value })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-brand-700">
          <span className="hidden sm:inline">Items per page</span>
          <select
            className="input w-auto min-w-[5rem] py-2"
            value={pageSize}
            onChange={(event) => updateParams({ pageSize: event.target.value === "24" ? null : event.target.value })}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex overflow-hidden rounded-lg border border-brand-200">
          <button
            type="button"
            aria-label="Grid view"
            onClick={() => setView("grid")}
            className={
              view === "grid"
                ? "flex h-9 w-9 items-center justify-center bg-brand-800 text-white"
                : "flex h-9 w-9 items-center justify-center bg-white text-brand-600 hover:bg-brand-50"
            }
          >
            <GridIcon />
          </button>
          <button
            type="button"
            aria-label="List view"
            onClick={() => setView("list")}
            className={
              view === "list"
                ? "flex h-9 w-9 items-center justify-center bg-brand-800 text-white"
                : "flex h-9 w-9 items-center justify-center bg-white text-brand-600 hover:bg-brand-50"
            }
          >
            <ListIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
