import type {
  CategoryEntity,
  CategoryTreeNode,
  ProductEntity,
  SearchFacetResultEntity,
  SearchQueryResultEntity,
} from "@productinfoman/domain";

export type CatalogClientConfig = {
  baseUrl: string;
  organizationSlug: string;
};

export type SearchProductsParams = {
  q?: string;
  categoryId?: string;
  categoryPath?: string;
  filters?: Record<string, string | string[]>;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  groupByParent?: boolean;
  storefront?: boolean;
};

function buildSearchQuery(params: SearchProductsParams): string {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params.categoryPath) searchParams.set("categoryPath", params.categoryPath);
  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder);
  if (params.groupByParent != null) searchParams.set("groupByParent", String(params.groupByParent));
  if (params.storefront != null) searchParams.set("storefront", String(params.storefront));

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      const values = Array.isArray(value) ? value : [value];
      for (const entry of values) {
        searchParams.append(`filters[${key}]`, entry);
      }
    }
  }

  return searchParams.toString();
}

export class CatalogClient {
  constructor(private readonly config: CatalogClientConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Organization-Slug": this.config.organizationSlug,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // ignore
      }
      throw new Error(message);
    }

    return (await response.json()) as T;
  }

  searchProducts(params: SearchProductsParams = {}) {
    const query = buildSearchQuery({ storefront: true, ...params });
    return this.request<SearchQueryResultEntity>(`/api/v1/search?${query}`);
  }

  searchCategoryProducts(categoryId: string, params: SearchProductsParams = {}) {
    const query = buildSearchQuery({ storefront: true, ...params });
    return this.request<SearchQueryResultEntity>(
      `/api/v1/search/categories/${categoryId}?${query}`,
    );
  }

  getSearchFacets(params: SearchProductsParams = {}) {
    const query = buildSearchQuery({ storefront: true, ...params });
    return this.request<SearchFacetResultEntity>(`/api/v1/search/facets?${query}`);
  }

  getProduct(productId: string) {
    return this.request<ProductEntity>(`/api/v1/products/${productId}`);
  }

  listVariants(parentId: string) {
    return this.request<{ items: ProductEntity[] }>(`/api/v1/products/${parentId}/variants`);
  }

  getCategoryTree() {
    return this.request<{ items: CategoryTreeNode[] }>("/api/v1/categories/tree");
  }

  listCategories() {
    return this.request<{ items: CategoryEntity[] }>("/api/v1/categories");
  }

  async getCategoryByCode(code: string): Promise<CategoryEntity | null> {
    const { items } = await this.listCategories();
    return (
      items.find((category) => category.code === code || category.slug === code) ?? null
    );
  }
}

export function createCatalogClient(config: CatalogClientConfig): CatalogClient {
  return new CatalogClient(config);
}
