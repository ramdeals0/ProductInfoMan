"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProductListingPage } from "@/components/catalog/ProductListingPage";
import { LoadingGrid } from "@/components/ui/States";
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
    <ProductListingPage
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Search results" },
      ]}
      title={q ? `Search results for "${q}"` : "Search products"}
      description={`Browse matching products${q ? ` for "${q}"` : ""}.`}
      facets={facetsQuery.data?.facets ?? []}
      results={resultsQuery.data}
      isLoading={resultsQuery.isLoading}
      error={(resultsQuery.error as Error) ?? null}
    />
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingGrid />}>
      <SearchResults />
    </Suspense>
  );
}
