import type {
  FacetQueryResult,
  SearchDocument,
  SearchQueryInput,
  SearchQueryResult,
} from "@productinfoman/search-projection";
import {
  aggregateFacets,
  matchesSearchQuery,
  toSearchHit,
} from "@productinfoman/search-projection";

export interface SearchStore {
  ensureIndex(organizationId: string, indexName?: string): Promise<void>;
  indexDocument(organizationId: string, document: SearchDocument): Promise<void>;
  removeDocument(organizationId: string, productId: string): Promise<void>;
  getDocument(organizationId: string, productId: string): Promise<SearchDocument | null>;
  search(organizationId: string, query: SearchQueryInput, facetKeys?: string[]): Promise<SearchQueryResult>;
  facets(organizationId: string, query: SearchQueryInput, facetKeys: string[]): Promise<FacetQueryResult>;
  clearOrganization(organizationId: string): Promise<void>;
}

function paginate<T>(items: T[], page: number, pageSize: number): { total: number; page: number; pageSize: number; items: T[] } {
  const start = (page - 1) * pageSize;
  return {
    total: items.length,
    page,
    pageSize,
    items: items.slice(start, start + pageSize),
  };
}

function sortDocuments(docs: SearchDocument[], sortBy?: string, sortOrder: "asc" | "desc" = "asc"): SearchDocument[] {
  if (!sortBy) {
    return [...docs].sort((a, b) => a.title.localeCompare(b.title));
  }

  return [...docs].sort((a, b) => {
    const left = a.sortable_attributes[sortBy] ?? a.facet_fields[sortBy];
    const right = b.sortable_attributes[sortBy] ?? b.facet_fields[sortBy];
    const leftValue = Array.isArray(left) ? left[0] : left;
    const rightValue = Array.isArray(right) ? right[0] : right;
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    const cmp = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true });
    return sortOrder === "desc" ? -cmp : cmp;
  });
}

export class InMemorySearchStore implements SearchStore {
  private readonly documents = new Map<string, Map<string, SearchDocument>>();

  private bucket(organizationId: string): Map<string, SearchDocument> {
    let store = this.documents.get(organizationId);
    if (!store) {
      store = new Map();
      this.documents.set(organizationId, store);
    }
    return store;
  }

  async ensureIndex(): Promise<void> {
    return;
  }

  async indexDocument(organizationId: string, document: SearchDocument): Promise<void> {
    this.bucket(organizationId).set(document.product_id, document);
  }

  async removeDocument(organizationId: string, productId: string): Promise<void> {
    this.bucket(organizationId).delete(productId);
  }

  async getDocument(organizationId: string, productId: string): Promise<SearchDocument | null> {
    return this.bucket(organizationId).get(productId) ?? null;
  }

  async clearOrganization(organizationId: string): Promise<void> {
    this.documents.delete(organizationId);
  }

  private filteredDocuments(organizationId: string, query: SearchQueryInput): SearchDocument[] {
    const docs = [...this.bucket(organizationId).values()];
    return sortDocuments(docs.filter((doc) => matchesSearchQuery(doc, query)), query.sortBy, query.sortOrder);
  }

  async search(
    organizationId: string,
    query: SearchQueryInput,
    _facetKeys: string[] = [],
  ): Promise<SearchQueryResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filtered = this.filteredDocuments(organizationId, query);

    if (query.groupByParent) {
      const groups = new Map<string, ReturnType<typeof toSearchHit>[]>();
      for (const doc of filtered) {
        const hit = toSearchHit(doc);
        const group = groups.get(doc.group_key) ?? [];
        group.push(hit);
        groups.set(doc.group_key, group);
      }
      const groupedItems = [...groups.entries()].map(([group_key, items]) => ({ group_key, items }));
      const paged = paginate(groupedItems, page, pageSize);
      return {
        total: groupedItems.length,
        page: paged.page,
        pageSize: paged.pageSize,
        items: paged.items.flatMap((group) => group.items),
        groups: paged.items,
      };
    }

    const paged = paginate(filtered.map(toSearchHit), page, pageSize);
    return paged;
  }

  async facets(
    organizationId: string,
    query: SearchQueryInput,
    facetKeys: string[],
  ): Promise<FacetQueryResult> {
    const filtered = this.filteredDocuments(organizationId, query);
    return {
      total: filtered.length,
      facets: aggregateFacets(filtered, facetKeys),
    };
  }
}

let sharedStore: SearchStore | null = null;

export async function getSearchStore(): Promise<SearchStore> {
  if (sharedStore) return sharedStore;

  if (process.env.OPENSEARCH_URL) {
    const { OpenSearchStore } = await import("./search.opensearch.js");
    sharedStore = new OpenSearchStore(process.env.OPENSEARCH_URL);
  } else {
    sharedStore = new InMemorySearchStore();
  }

  return sharedStore;
}

export function resetSearchStore(store?: SearchStore): void {
  sharedStore = store ?? new InMemorySearchStore();
}
