import type { SearchDocument } from "@productinfoman/search-projection";
import { defaultIndexName, PRODUCT_SEARCH_INDEX_MAPPING } from "@productinfoman/search-projection";
import { loadApiEnv } from "@productinfoman/config";
import type { SearchStore } from "./search.store.js";
import { getCircuitBreaker } from "../../lib/resilience/circuit-breaker.js";
import { withTimeout } from "../../lib/resilience/timeout.js";

type OpenSearchClient = {
  indices: {
    exists: (params: { index: string }) => Promise<{ body: boolean }>;
    create: (params: { index: string; body: unknown }) => Promise<unknown>;
    delete: (params: { index: string }) => Promise<unknown>;
  };
  index: (params: { index: string; id: string; body: unknown; refresh?: boolean }) => Promise<unknown>;
  delete: (params: { index: string; id: string; refresh?: boolean }) => Promise<unknown>;
  get: (params: { index: string; id: string }) => Promise<{ body: { _source: SearchDocument } }>;
  search: (params: { index: string; body: unknown }) => Promise<{ body: Record<string, unknown> }>;
};

const OPENSEARCH_BREAKER = "opensearch";

export class OpenSearchStore implements SearchStore {
  private client: OpenSearchClient | null = null;

  constructor(private readonly node: string) {}

  private async getClient(): Promise<OpenSearchClient> {
    if (this.client) return this.client;
    const { Client } = await import("@opensearch-project/opensearch");
    this.client = new Client({ node: this.node }) as unknown as OpenSearchClient;
    return this.client;
  }

  private async guarded<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const { DB_QUERY_TIMEOUT_MS } = loadApiEnv();
    return getCircuitBreaker(OPENSEARCH_BREAKER).execute(() =>
      withTimeout(operation(), DB_QUERY_TIMEOUT_MS, label),
    );
  }

  private indexForOrg(organizationId: string): string {
    return defaultIndexName(organizationId);
  }

  async ensureIndex(organizationId: string): Promise<void> {
    const client = await this.getClient();
    const index = this.indexForOrg(organizationId);
    await this.guarded("opensearchEnsureIndex", async () => {
      const exists = await client.indices.exists({ index });
      if (!exists.body) {
        await client.indices.create({
          index,
          body: PRODUCT_SEARCH_INDEX_MAPPING,
        });
      }
    });
  }

  async indexDocument(organizationId: string, document: SearchDocument): Promise<void> {
    const client = await this.getClient();
    await this.guarded("opensearchIndex", async () => {
      await this.ensureIndex(organizationId);
      await client.index({
        index: this.indexForOrg(organizationId),
        id: document.product_id,
        body: document,
        refresh: true,
      });
    });
  }

  async removeDocument(organizationId: string, productId: string): Promise<void> {
    const client = await this.getClient();
    await this.guarded("opensearchDelete", async () => {
      await client.delete({
        index: this.indexForOrg(organizationId),
        id: productId,
        refresh: true,
      });
    });
  }

  async getDocument(organizationId: string, productId: string): Promise<SearchDocument | null> {
    const client = await this.getClient();
    try {
      const response = await this.guarded("opensearchGet", () =>
        client.get({
          index: this.indexForOrg(organizationId),
          id: productId,
        }),
      );
      return response.body._source;
    } catch {
      return null;
    }
  }

  async clearOrganization(organizationId: string): Promise<void> {
    const client = await this.getClient();
    const index = this.indexForOrg(organizationId);
    await this.guarded("opensearchClearOrg", async () => {
      const exists = await client.indices.exists({ index });
      if (exists.body) {
        await client.indices.delete({ index });
      }
    });
  }

  async search(organizationId: string, query: import("@productinfoman/search-projection").SearchQueryInput, facetKeys: string[] = []) {
    const client = await this.getClient();
    const must: unknown[] = [{ term: { organization_id: organizationId } }];

    if (query.q) {
      must.push({
        multi_match: {
          query: query.q,
          fields: ["search_text", "title", "sku", "brand"],
        },
      });
    }
    if (query.categoryPath) {
      must.push({ prefix: { category_paths: query.categoryPath } });
    } else if (query.categoryId) {
      must.push({ term: { category_ids: query.categoryId } });
    }
    if (query.storefront) {
      must.push({ term: { storefront_active: true } });
    }
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        must.push({ term: { [`facet_fields.${key}`]: value } });
      }
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const sortField = query.sortBy ? `sortable_attributes.${query.sortBy}` : "sortable_attributes.title";
    const body: Record<string, unknown> = {
      from: (page - 1) * pageSize,
      size: pageSize,
      query: { bool: { must } },
      sort: [{ [sortField]: query.sortOrder ?? "asc" }],
    };

    if (facetKeys.length > 0) {
      body.aggs = Object.fromEntries(
        facetKeys.map((key) => [key, { terms: { field: `facet_fields.${key}`, size: 50 } }]),
      );
    }

    const response = await this.guarded("opensearchSearch", () =>
      client.search({
        index: this.indexForOrg(organizationId),
        body,
      }),
    );

    const hits = (response.body.hits as { total?: { value?: number }; hits?: Array<{ _source: SearchDocument }> }) ?? {};
    const total = typeof hits.total === "object" ? hits.total.value ?? 0 : 0;
    const items = (hits.hits ?? []).map((hit) => ({
      product_id: hit._source.product_id,
      sku: hit._source.sku,
      title: hit._source.title,
      brand: hit._source.brand,
      status: hit._source.status,
      parent_product_id: hit._source.parent_product_id,
      group_key: hit._source.group_key,
      category_ids: hit._source.category_ids,
      facet_fields: hit._source.facet_fields,
    }));

    return { total, page, pageSize, items };
  }

  async facets(
    organizationId: string,
    query: import("@productinfoman/search-projection").SearchQueryInput,
    facetKeys: string[],
  ) {
    const result = await this.search(organizationId, { ...query, page: 1, pageSize: 0 }, facetKeys);
    return {
      total: result.total,
      facets: facetKeys.map((key) => ({ key, buckets: [] as Array<{ value: string; count: number }> })),
    };
  }
}
