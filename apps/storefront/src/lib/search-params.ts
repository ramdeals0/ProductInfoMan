import type { CategoryEntity, CategoryTreeNode } from "@productinfoman/domain";
import type { SearchProductsParams } from "@productinfoman/api-client";

export type ListingView = "grid" | "list";

export const SORT_OPTIONS = [
  { value: "relevance", sortBy: undefined, sortOrder: undefined, label: "Best Match" },
  { value: "price_asc", sortBy: "price", sortOrder: "asc" as const, label: "Price: Low to High" },
  { value: "price_desc", sortBy: "price", sortOrder: "desc" as const, label: "Price: High to Low" },
  { value: "title_asc", sortBy: "title", sortOrder: "asc" as const, label: "Name: A to Z" },
  { value: "title_desc", sortBy: "title", sortOrder: "desc" as const, label: "Name: Z to A" },
] as const;

export const PAGE_SIZE_OPTIONS = [24, 48, 72] as const;

export function flattenCategories(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];
  const walk = (items: CategoryTreeNode[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(nodes);
  return result;
}

export interface CategorySelectOption {
  code: string;
  label: string;
}

export function categorySelectOptions(nodes: CategoryTreeNode[]): CategorySelectOption[] {
  const options: CategorySelectOption[] = [];
  const walk = (items: CategoryTreeNode[], depth: number) => {
    for (const item of items) {
      const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
      options.push({ code: item.code, label: `${prefix}${item.name}` });
      if (item.children?.length) walk(item.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return options;
}

export function findCategoryNode(
  nodes: CategoryTreeNode[],
  predicate: (node: CategoryTreeNode) => boolean,
): CategoryTreeNode | null {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const match = findCategoryNode(node.children, predicate);
    if (match) return match;
  }
  return null;
}

export function buildCategoryBreadcrumbs(
  allCategories: CategoryEntity[],
  category: CategoryEntity,
): Array<{ label: string; href?: string }> {
  const crumbs: Array<{ label: string; href?: string }> = [{ label: "Home", href: "/" }];
  const parts = category.path.split("/").filter(Boolean);
  let currentPath = "";

  for (const part of parts) {
    currentPath += `/${part}`;
    const match = allCategories.find((entry) => entry.path === currentPath);
    if (match) {
      crumbs.push({
        label: match.name,
        href: `/category/${match.code}`,
      });
    }
  }

  return crumbs;
}

export function parseFacetFilters(searchParams: URLSearchParams): Record<string, string | string[]> {
  const filters: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    const match = key.match(/^facet\[(.+)\]$/);
    if (!match) continue;
    const facetKey = match[1]!;
    const existing = filters[facetKey];
    if (!existing) {
      filters[facetKey] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      filters[facetKey] = [existing, value];
    }
  }
  return filters;
}

export function buildFacetSearchParams(
  base: URLSearchParams,
  filters: Record<string, string | string[]>,
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of [...params.keys()]) {
    if (key.startsWith("facet[")) params.delete(key);
  }
  for (const [key, value] of Object.entries(filters)) {
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      params.append(`facet[${key}]`, entry);
    }
  }
  return params;
}

export function getListingView(searchParams: URLSearchParams): ListingView {
  return searchParams.get("view") === "list" ? "list" : "grid";
}

export function getActiveFacetFilters(
  searchParams: URLSearchParams,
): Array<{ key: string; value: string }> {
  const active: Array<{ key: string; value: string }> = [];
  for (const [paramKey, value] of searchParams.entries()) {
    const match = paramKey.match(/^facet\[(.+)\]$/);
    if (match) active.push({ key: match[1]!, value });
  }
  return active;
}

export function toSearchParams(
  searchParams: URLSearchParams,
  categoryId?: string,
): SearchProductsParams {
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const requestedPageSize = Number.parseInt(searchParams.get("pageSize") ?? "24", 10);
  const pageSize = (PAGE_SIZE_OPTIONS as readonly number[]).includes(requestedPageSize)
    ? requestedPageSize
    : 24;
  const sortValue = searchParams.get("sort") ?? "relevance";
  const sortOption =
    SORT_OPTIONS.find((option) => option.value === sortValue) ?? SORT_OPTIONS[0];

  return {
    q: searchParams.get("q") ?? undefined,
    categoryId: categoryId ?? searchParams.get("categoryId") ?? undefined,
    page: Number.isNaN(page) ? 1 : page,
    pageSize,
    sortBy: sortOption.sortBy,
    sortOrder: sortOption.sortOrder,
    filters: parseFacetFilters(searchParams),
  };
}
