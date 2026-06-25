import type { CategoryTreeNode } from "@productinfoman/domain";
import type { SearchProductsParams } from "@productinfoman/api-client";

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

export function toSearchParams(
  searchParams: URLSearchParams,
  categoryId?: string,
): SearchProductsParams {
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  return {
    q: searchParams.get("q") ?? undefined,
    categoryId: categoryId ?? searchParams.get("categoryId") ?? undefined,
    page: Number.isNaN(page) ? 1 : page,
    pageSize: 12,
    filters: parseFacetFilters(searchParams),
  };
}
