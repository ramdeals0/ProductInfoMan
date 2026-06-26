"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ProductListingPage } from "@/components/catalog/ProductListingPage";
import { StoreLayout } from "@/components/layout/StoreShell";
import { ErrorMessage, LoadingGrid } from "@/components/ui/States";
import { createStorefrontCatalog } from "@/lib/catalog";
import {
  buildCategoryBreadcrumbs,
  findCategoryNode,
  toSearchParams,
} from "@/lib/search-params";

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

  const allCategoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => catalog.listCategories(),
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
      <StoreLayout variant="catalog">
        <LoadingGrid />
      </StoreLayout>
    );
  }

  if (categoryQuery.error || !categoryQuery.data) {
    return (
      <StoreLayout variant="catalog">
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
  const breadcrumbs =
    allCategoriesQuery.data?.items != null
      ? buildCategoryBreadcrumbs(allCategoriesQuery.data.items, category)
      : [{ label: "Home", href: "/" }, { label: category.name }];

  return (
    <ProductListingPage
      breadcrumbs={breadcrumbs}
      title={category.name}
      description={category.path.replace(/\//g, " / ").replace(/^\s*/, "")}
      subcategories={subcategories}
      facets={facetsQuery.data?.facets ?? []}
      results={resultsQuery.data}
      isLoading={resultsQuery.isLoading}
      error={(resultsQuery.error as Error) ?? null}
    />
  );
}

export default function CategoryPage() {
  return (
    <Suspense fallback={<LoadingGrid />}>
      <CategoryResults />
    </Suspense>
  );
}
