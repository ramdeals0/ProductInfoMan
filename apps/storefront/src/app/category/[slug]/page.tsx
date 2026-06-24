"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FacetSidebar } from "@/components/catalog/FacetSidebar";
import { ProductGrid } from "@/components/catalog/ProductCard";
import { Pagination } from "@/components/catalog/Pagination";
import { Breadcrumbs, PageTitle, StoreLayout } from "@/components/layout/StoreShell";
import { ErrorMessage, LoadingGrid } from "@/components/ui/States";
import { createStorefrontCatalog } from "@/lib/catalog";
import { findCategoryNode, toSearchParams } from "@/lib/search-params";

function CategoryResults() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const catalog = createStorefrontCatalog();

  const categoryQuery = useQuery({
    queryKey: ["category", params.slug],
    queryFn: () => catalog.getCategoryByCode(params.slug),
  });

  const treeQuery = useQuery({
    queryKey: ["category-tree"],
    queryFn: () => catalog.getCategoryTree(),
  });

  const searchInput = toSearchParams(searchParams, categoryQuery.data?.id);

  const resultsQuery = useQuery({
    queryKey: ["category-search", params.slug, searchInput],
    queryFn: () => catalog.searchCategoryProducts(categoryQuery.data!.id, searchInput),
    enabled: !!categoryQuery.data?.id,
  });

  const facetsQuery = useQuery({
    queryKey: ["category-facets", params.slug, searchInput],
    queryFn: () => catalog.getSearchFacets({ ...searchInput, categoryId: categoryQuery.data!.id }),
    enabled: !!categoryQuery.data?.id,
  });

  if (categoryQuery.isLoading) {
    return (
      <StoreLayout>
        <LoadingGrid />
      </StoreLayout>
    );
  }

  if (categoryQuery.error || !categoryQuery.data) {
    return (
      <StoreLayout>
        <ErrorMessage message="Category not found" />
      </StoreLayout>
    );
  }

  const category = categoryQuery.data;
  const treeNode = treeQuery.data
    ? findCategoryNode(
        treeQuery.data.items,
        (node) => node.id === category.id || node.code === category.code,
      )
    : null;
  const subcategories = treeNode?.children ?? [];

  return (
    <StoreLayout>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: category.name },
        ]}
      />
      <PageTitle
        title={category.name}
        description={`Browse products in ${category.path}`}
      />

      {subcategories.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Subcategories
          </h2>
          <div className="flex flex-wrap gap-2">
            {subcategories.map((subcategory) => (
              <Link
                key={subcategory.id}
                href={`/category/${subcategory.code}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
              >
                {subcategory.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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

export default function CategoryPage() {
  return (
    <Suspense fallback={<LoadingGrid />}>
      <CategoryResults />
    </Suspense>
  );
}
