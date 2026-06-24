"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FacetSidebar } from "@/components/catalog/FacetSidebar";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { Pagination } from "@/components/catalog/Pagination";
import { Breadcrumbs, PageTitle, StoreLayout } from "@/components/layout/StoreShell";
import { ErrorMessage, LoadingGrid } from "@/components/ui/States";
import { createStorefrontCatalog } from "@/lib/catalog";
import { toSearchParams } from "@/lib/search-params";

function SearchResults() {
  const searchParams = useSearchParams();
  const catalog = createStorefrontCatalog();
  const params = toSearchParams(searchParams);
  const q = searchParams.get("q") ?? "";

  const resultsQuery = useQuery({
    queryKey: ["search", params],
    queryFn: () => catalog.searchProducts(params),
  });

  const facetsQuery = useQuery({
    queryKey: ["search-facets", params],
    queryFn: () => catalog.getSearchFacets(params),
  });

  return (
    <StoreLayout>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      <PageTitle
        title={q ? `Search: ${q}` : "Search products"}
        description={`${resultsQuery.data?.total ?? 0} results`}
      />

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <FacetSidebar facets={facetsQuery.data?.facets ?? []} />
        <div>
          {resultsQuery.isLoading ? <LoadingGrid /> : null}
          {resultsQuery.error ? (
            <ErrorMessage message={(resultsQuery.error as Error).message} />
          ) : null}
          {resultsQuery.data ? (
            <>
              <ProductGrid items={resultsQuery.data.items} />
              <Pagination
                page={resultsQuery.data.page}
                pageSize={resultsQuery.data.pageSize}
                total={resultsQuery.data.total}
              />
            </>
          ) : null}
        </div>
      </div>
    </StoreLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingGrid />}>
      <SearchResults />
    </Suspense>
  );
}
