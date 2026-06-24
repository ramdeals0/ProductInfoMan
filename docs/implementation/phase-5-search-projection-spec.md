# Phase 5 — Search Projection Spec Alignment

Phase 5 is **implemented** on top of Phases 1–4. Search is a read-model projection only;
PostgreSQL remains the source of truth.

## Stack

Fastify · Prisma · OpenSearch (optional) · `packages/search-projection` · BullMQ with sync fallback · In-memory store for tests

## Index schema (ASSUMPTION CHANGEs)

Index name: `product_projection` (per tenant/org routing in `search.opensearch.ts`).

| Brief field | Implementation | Notes |
|-------------|----------------|-------|
| `product_id` | `product_id` | Keyword |
| `parent_product_id` | `parent_product_id` | Nullable |
| `sku` | `sku` | Keyword |
| `variant_sku` | Same `sku` on variant rows | **ASSUMPTION CHANGE:** variant docs use variant product id + sku |
| `title` | `title` + `search_text` | Text search via `search_text` |
| `brand` | `brand` | Keyword |
| `workflow_state` | `status` | `APPROVED`, `PUBLISH_READY`, `PUBLISHED` indexable |
| `categories` | `category_ids` | Category UUIDs |
| `category_paths` | `category_paths` | Materialized paths e.g. `/apparel/mens/shirts` |
| `attributes_flat` | `filterable_attributes` + `variant_attributes` | **ASSUMPTION CHANGE:** split by purpose |
| `facets` | `facet_fields` | From Phase 2 facet definitions |
| `price` | Not in MVP | **ASSUMPTION CHANGE:** omitted until pricing domain exists |
| `created_at` / `updated_at` | `published_at` + index metadata | **ASSUMPTION CHANGE:** uses publish timestamp when set |
| — | `group_key` | Parent id for variant grouping |
| — | `product_type` | SIMPLE / PARENT / VARIANT |
| — | `channel_availability` | Stub for Phase 6 publishing |

Package: `packages/search-projection` — `SearchDocument`, `buildSearchDocument()`, `isIndexableStatus()`, `aggregateFacets()`.

Builder: `apps/api/src/modules/search/search.projection.ts` → `buildProductSearchDocument()`.

## Domain types

| Brief type | Export |
|------------|--------|
| ProductProjection | `SearchDocument` in `search-projection`; `SearchHitEntity` in API responses |
| Search results | `SearchQueryResultEntity` |
| Facet aggregations | `SearchFacetResultEntity` |
| Index jobs | `SearchProjectionJobEntity`, `SearchReindexRunEntity` |

## Indexing service (`search.service.ts`)

| Brief method | Implementation |
|--------------|----------------|
| `buildProjection(productId)` | `buildProductSearchDocument()` — returns `null` if not indexable |
| `indexProduct(productId)` | `indexProduct()` — queues INDEX or REMOVE by status |
| `removeProduct(productId)` | `removeProductFromIndex()` |
| `reindexAll()` | `startReindex()` — streams indexable products, bulk index |
| `handleProductChanged(productId)` | `handleProductChange()` — index or remove |

## Jobs and events

| Brief queue | Implementation |
|-------------|----------------|
| `search:index` | `search-jobs` queue, types `INDEX_PRODUCT`, `REMOVE_PRODUCT` |
| `search:reindex` | `REINDEX_ALL` job type |

Sync fallback: `SEARCH_SYNC=true` or missing `REDIS_URL`.

Wired to domain events via integration layer (`product.*`, `workflow.*` → `handleProductChange`).

## API endpoints

Base: `/api/v1` · Header: `X-Organization-Slug: demo`

| Brief | Implemented |
|-------|-------------|
| POST /search/reindex | Done (202) |
| POST /search/index-product/:id | Done |
| POST /search/remove-product/:id | Done |
| GET /search | Done — `q`, `categoryId`, `filters`, pagination, `groupByParent` |
| GET /search/facets | Done |
| — | `GET /search/categories/:id` (category browse) |
| — | `GET /search/debug/:id` (ops/debug) |

## Workflow enforcement

`isIndexableStatus()` allows: `APPROVED`, `PUBLISH_READY`, `PUBLISHED`.

Draft, in-review, rejected, archived → `buildSearchDocument()` returns `null`; index jobs become REMOVE.

## Facet wiring

At index time, `buildProductSearchDocument()` loads category facet definitions and maps `sourceAttributeKey` → `facet_fields` using resolved product attributes (inheritance-aware).

## Tests

```bash
pnpm --filter @productinfoman/search-projection test
pnpm --filter @productinfoman/api test -- src/__tests__/search-projection.test.ts
```

## Deliverables checklist

- [x] `product_projection` index mapping
- [x] Build projection + index/remove/reindex
- [x] Only approved/published (and publish-ready) in index
- [x] GET /search with facets and pagination
- [x] Full reindex endpoint
- [x] Tests for projection, indexing, and search behavior

## Out of scope (later phases)

AI relevance, storefront UI, channel-specific exports (Phase 6), making search source of truth.
