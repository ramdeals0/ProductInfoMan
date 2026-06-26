"use client";

import { useState } from "react";
import type { SearchFacetAggregationEntity } from "@productinfoman/domain";
import type { SearchQueryResultEntity } from "@productinfoman/domain";
import type { CategoryTreeNode } from "@productinfoman/domain";
import { ActiveFacetChips } from "@/components/catalog/ActiveFacetChips";
import { CategorySubnav } from "@/components/catalog/CategorySubnav";
import { FacetSidebar } from "@/components/catalog/FacetSidebar";
import { ProductGrid, ProductList } from "@/components/catalog/ProductCard";
import { ProductListingToolbar } from "@/components/catalog/ProductListingToolbar";
import { Pagination } from "@/components/catalog/Pagination";
import { Breadcrumbs, PageTitle, StoreLayout } from "@/components/layout/StoreShell";
import { ErrorMessage, LoadingGrid } from "@/components/ui/States";
import { getListingView } from "@/lib/search-params";
import { useSearchParams } from "next/navigation";

type ProductListingPageProps = {
  breadcrumbs: Array<{ label: string; href?: string }>;
  title: string;
  description?: string;
  subcategories?: CategoryTreeNode[];
  facets: SearchFacetAggregationEntity[];
  results: SearchQueryResultEntity | undefined;
  isLoading: boolean;
  error: Error | null;
};

export function ProductListingPage({
  breadcrumbs,
  title,
  description,
  subcategories = [],
  facets,
  results,
  isLoading,
  error,
}: ProductListingPageProps) {
  const searchParams = useSearchParams();
  const view = getListingView(searchParams);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  return (
    <StoreLayout variant="catalog">
      <Breadcrumbs items={breadcrumbs} />
      <PageTitle title={title} description={description} />

      {subcategories.length > 0 ? <CategorySubnav subcategories={subcategories} /> : null}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <FacetSidebar facets={facets} />
        </div>

        <div className="catalog-panel overflow-hidden">
          <ProductListingToolbar total={results?.total ?? 0} />
          <ActiveFacetChips />

          <div className="border-b border-brand-200 px-4 py-3 lg:hidden">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setMobileFiltersOpen((open) => !open)}
            >
              {mobileFiltersOpen ? "Hide filters" : "Filter results"}
            </button>
          </div>

          {mobileFiltersOpen ? (
            <div className="border-b border-brand-200 p-4 lg:hidden">
              <FacetSidebar facets={facets} className="border-0 shadow-none" />
            </div>
          ) : null}

          <div className="p-4">
            {isLoading ? <LoadingGrid /> : null}
            {error ? <ErrorMessage message={error.message} /> : null}
            {results ? (
              <>
                {view === "list" ? (
                  <ProductList items={results.items} />
                ) : (
                  <ProductGrid items={results.items} />
                )}
                <Pagination
                  page={results.page}
                  pageSize={results.pageSize}
                  total={results.total}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
