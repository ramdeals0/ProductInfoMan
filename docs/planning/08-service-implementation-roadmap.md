# Service-by-Service Implementation Roadmap

> **Status:** Cursor-ready execution plan  
> **Stack:** Next.js, NestJS or Fastify, PostgreSQL, Redis/BullMQ, OpenSearch, S3, Zod, Prisma, OpenTelemetry  
> **Rule:** Build in dependency order. No Admin UI until API contracts stabilize.

---

## 1. Project Summary

**ProductInfoMan** is a governed PIM platform for ecommerce. PostgreSQL is the system of record for all write models. Services are logical modules inside a modular monolith (MVP), extractable later. Async work flows through Redis + BullMQ. Browse/filter reads come from OpenSearch projections, not live joins.

**Build order (mandatory):**

```
1. Product Core
2. Taxonomy and Facet
3. Import and Validation
4. Workflow and Approval
5. Search Projection
6. Publishing and Syndication
7. Audit and Reporting
8. Integration and Eventing (hardening)
9. Admin UI and Operations Console
```

**MVP cutline:** One catalog domain, one approval flow, CSV import, one export target (custom JSON), basic facet projection to OpenSearch.

**Deferred:** AI enrichment, localization, advanced merchandising, supplier self-service, multi-channel orchestration.

---

## 2. Service-by-Service Roadmap

| Order | Service | System of Record | Blocks |
|-------|---------|------------------|--------|
| 1 | Product Core | Product, SKU, relationships, attribute values | Everything |
| 2 | Taxonomy and Facet | Category, attribute schema, facet rules | Import, Search, Publish |
| 3 | Import and Validation | ImportJob (runtime); writes via Product Core | Workflow |
| 4 | Workflow and Approval | Workflow state on Product; ApprovalRecord | Publish |
| 5 | Search Projection | OpenSearch index (read model) | Browse APIs |
| 6 | Publishing and Syndication | PublishSnapshot, Channel, ExportJob | Downstream channels |
| 7 | Audit and Reporting | AuditLog, metrics aggregates | Compliance |
| 8 | Integration and Eventing | Outbox, webhook subscriptions | External systems |
| 9 | Admin UI | None (client only) | — |

---

## 3. Service Specifications

---

### 3.1 Product Core Service

#### Purpose
Own canonical product entities, SKUs, parent-child relationships, attribute value storage, and relationship invariants. Every other service reads or writes product data through this service's APIs.

#### Responsibilities
- CRUD for products (SIMPLE, PARENT, VARIANT; BUNDLE/COLLECTION stubs only in MVP)
- SKU uniqueness enforcement per tenant
- Parent-child linking and variant axis value storage
- Attribute value persistence (EAV) on products
- Inheritance resolution (read-time merge with parent)
- Relationship rules: one parent per variant, unique variant axis combos per parent
- Soft delete and archive
- Expose resolved product DTO for downstream consumers

#### Inputs
- HTTP commands: create/update/delete product, set attribute values, link parent/child
- Internal calls from Import service (validated upsert payloads)
- Category IDs (from Taxonomy) for assignment only — Taxonomy owns category definitions

#### Outputs
- `ProductDTO` (resolved attributes with `source: local | inherited | overridden`)
- `ProductListDTO` (paginated, filterable by status/SKU/title)
- Domain events (via outbox): `product.created`, `product.updated`, `product.deleted`, `product.attributes_changed`

#### Dependencies
- **None** for schema bootstrap (tenant + product tables first)
- Taxonomy service for category assignment validation (Phase 1b — after Taxonomy tables exist, add FK validation)

#### Database Tables (create first — Sprint 1)

| Table | Owner | Notes |
|-------|-------|-------|
| `Organization` | Platform | Tenant root |
| `Product` | Product Core | `id`, `organizationId`, `productType`, `sku`, `parentId`, `status`, `title`, `description`, `brand`, `primaryCategoryId`, timestamps |
| `ProductAttributeValue` | Product Core | `productId`, `attributeDefinitionId`, `value` (JSONB), `source`, `inheritedFromProductId` |
| `ProductCategory` | Product Core | Secondary category assignments |
| `ProductRelationship` | Product Core | Bundle/collection edges (schema only in MVP; unused until Phase 3) |
| `ProductMedia` | Product Core | `url`, `role`, `sortOrder` (URL refs only in MVP) |

**Indexes (day 1):**
- `UNIQUE (organizationId, sku) WHERE deletedAt IS NULL`
- `(organizationId, status)`, `(organizationId, parentId)`, `(productId, attributeDefinitionId)`

#### Required APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/products` | Create product |
| GET | `/v1/products/:id` | Get resolved product |
| PATCH | `/v1/products/:id` | Update core fields |
| DELETE | `/v1/products/:id` | Soft delete |
| GET | `/v1/products` | List/search (DB-backed; OpenSearch later) |
| POST | `/v1/products/:id/attributes` | Set attribute values (batch) |
| POST | `/v1/products/:parentId/variants` | Create child variant |
| GET | `/v1/products/:id/variants` | List children |

#### Required Jobs
- None in Sprint 1

#### Events to Emit First
```
product.created     { organizationId, productId, productType, sku, status }
product.updated     { organizationId, productId, changedFields[] }
product.deleted     { organizationId, productId }
product.attributes_changed { organizationId, productId, attributeKeys[] }
```

#### Acceptance Criteria
- [ ] Create SIMPLE, PARENT, VARIANT products via API
- [ ] SKU unique per tenant; duplicate returns 409
- [ ] Child inherits parent attributes; override persisted with `source=OVERRIDDEN`
- [ ] GET returns merged attribute map with source tags
- [ ] Sibling variants cannot share identical axis value combination
- [ ] All writes scoped to `organizationId` from auth context
- [ ] OpenAPI spec published; Zod request schemas match

#### Exposes to Next Service
- Stable `ProductDTO` and attribute value write contract
- `primaryCategoryId` field (Taxonomy validates category exists)
- Event envelope for `product.*` topics

---

### 3.2 Taxonomy and Facet Service

#### Purpose
Own category hierarchy, attribute definitions, category-specific attribute sets, and facet derivation rules. Product Core stores values; this service defines the schema and rules.

#### Responsibilities
- Category tree CRUD (hierarchy, paths, breadcrumbs)
- AttributeDefinition + AttributeGroup management
- CategoryAttributeSet bindings (required/optional/hidden per category)
- Variant axis designation per category (`isVariantAxis` on attributes)
- FacetDefinition + FacetRule (MVP: DIRECT mapping only)
- Resolve effective attribute schema for a product given its categories
- Compute facet values for a product (pure function; no product writes)

#### Inputs
- Admin API commands for taxonomy/attribute/facet config
- `productId` or `ProductDTO` + attribute values from Product Core (for facet computation)

#### Outputs
- `CategoryDTO`, `CategoryTreeDTO`
- `AttributeSchemaDTO` (merged global + category attributes for a product)
- `FacetDefinitionDTO[]` per category
- `ComputedFacetDTO[]` per product
- Events: `category.created`, `attribute_definition.changed`, `category_attribute_set.changed`, `facet_rule.changed`

#### Dependencies
- Product Core (reads `primaryCategoryId`; no hard dependency for taxonomy CRUD)
- Product Core must exist before **assigning** categories to products

#### Database Tables (Sprint 2)

| Table | Owner |
|-------|-------|
| `Category` | Taxonomy |
| `AttributeGroup` | Taxonomy |
| `AttributeDefinition` | Taxonomy |
| `AttributeEnumValue` | Taxonomy |
| `CategoryAttributeSet` | Taxonomy |
| `CategoryAttributeBinding` | Taxonomy |
| `FacetDefinition` | Taxonomy |
| `FacetRule` | Taxonomy |

**FK:** `Product.primaryCategoryId → Category.id` (add migration after Category exists)

#### Required APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST/GET/PATCH/DELETE | `/v1/categories` | Category CRUD |
| GET | `/v1/categories/tree` | Full tree |
| POST/GET/PATCH | `/v1/attributes` | Attribute definitions |
| PUT | `/v1/categories/:id/attribute-set` | Bind attributes to category |
| GET | `/v1/categories/:id/attribute-schema` | Resolved schema |
| POST/GET | `/v1/facets` | Facet definitions |
| GET | `/v1/products/:id/facets` | Computed facets (calls Product Core internally) |

#### Required Jobs
- `recompute-facet-cache` (optional MVP) — cache facet definitions per category in Redis

#### Events to Emit First
```
category.created / category.updated
attribute_definition.changed   { attributeDefinitionId, organizationId }
category_attribute_set.changed { categoryId, organizationId }
facet_rule.changed             { facetDefinitionId, categoryId }
```

#### Acceptance Criteria
- [ ] Category tree with materialized path (e.g. `/apparel/mens/shirts`)
- [ ] No circular category references
- [ ] Category attribute set marks fields required/optional/hidden
- [ ] Variant axes configurable per category
- [ ] Facet DIRECT rule maps attribute value → facet value
- [ ] `GET /categories/:id/attribute-schema` returns correct merged schema
- [ ] Product Core rejects invalid `primaryCategoryId`

#### Exposes to Next Service
- `AttributeSchemaDTO` for validation (Import service)
- `FacetDefinitionDTO[]` for Search Projection
- `category_attribute_set.changed` triggers validation re-run on affected products

---

### 3.3 Import and Validation Service

#### Purpose
Ingest external catalog data, validate against taxonomy schema and product rules **before** writing, then upsert into Product Core.

#### Responsibilities
- CSV upload to S3; column mapping templates
- Dry-run validation (no writes)
- Commit import (upsert by SKU)
- Row-level error reporting
- Rule evaluation: required attributes, types, regex, SKU format, parent-child refs
- Import job lifecycle tracking
- REST bulk import API (JSON array)

#### Inputs
- CSV file (S3 URL) + mapping config
- JSON bulk payload via API
- `AttributeSchemaDTO` from Taxonomy
- Existing products from Product Core (for upsert/dedup)

#### Outputs
- `ImportJobDTO` with status, counts, errors
- `ImportValidationReportDTO` (dry-run)
- Writes: calls Product Core APIs only after validation passes
- Events: `import.started`, `import.completed`, `import.failed`, `validation.failed`

#### Dependencies
- **Product Core** (write target)
- **Taxonomy** (schema for validation)

#### Database Tables (Sprint 3)

| Table | Owner |
|-------|-------|
| `ImportJob` | Import |
| `ImportJobRow` | Import |
| `ImportMappingTemplate` | Import |
| `ValidationRule` | Import (config); shared read by Workflow |
| `ValidationResult` | Import (per-product evaluation cache) |

#### Required APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/imports` | Create import job (upload URL or inline CSV) |
| POST | `/v1/imports/:id/dry-run` | Validate without write |
| POST | `/v1/imports/:id/commit` | Execute upsert |
| GET | `/v1/imports/:id` | Job status + errors |
| GET | `/v1/imports/:id/errors.csv` | Download failed rows |
| POST | `/v1/products/bulk` | JSON bulk upsert (same validation path) |
| POST | `/v1/products/:id/validate` | On-demand validation |

#### Required Jobs (queue first)

| Job | Queue | Trigger |
|-----|-------|---------|
| `import.parse-csv` | `import` | POST `/imports` |
| `import.validate-rows` | `import` | After parse |
| `import.commit-rows` | `import` | POST `commit` |
| `validation.run-product` | `validation` | On product save (async re-validation) |

**BullMQ setup (Sprint 3):** Redis connection, `import` + `validation` queues, dead-letter handling.

#### Events to Emit First
```
import.started    { importJobId, organizationId, rowCount }
import.completed  { importJobId, successCount, errorCount }
import.failed     { importJobId, reason }
validation.failed { productId, errors[] }
validation.passed { productId }
```

#### Acceptance Criteria
- [ ] CSV dry-run returns errors per row without DB product changes
- [ ] Commit upserts by SKU idempotently
- [ ] Required category attributes enforced using Taxonomy schema
- [ ] Invalid parent SKU references rejected
- [ ] Partial success configurable (default: skip bad rows, commit good)
- [ ] Import job auditable (row counts, duration)
- [ ] 1,000-row CSV processes via job queue without HTTP timeout

#### Exposes to Next Service
- `ValidationResult` on product (read by Workflow for publish-ready gate)
- `validation.passed` / `validation.failed` events
- Validated product records in Product Core

---

### 3.4 Workflow and Approval Service

#### Purpose
Manage product lifecycle states and a single approval flow. Gate transitions on validation results from Import service.

#### Responsibilities
- State machine: `DRAFT → IN_REVIEW → APPROVED → PUBLISH_READY → PUBLISHED`
- Submit for review, approve, reject, request changes
- Single approver role check (MVP)
- Transition guards: cannot reach `PUBLISH_READY` if blocking validation failures exist
- Approval comments
- Emit state change events

#### Inputs
- Commands from API (submit, approve, reject)
- `ValidationResult` from Import/Validation service
- Product status from Product Core

#### Outputs
- `WorkflowStateDTO`, `ApprovalRecordDTO`
- Updates `Product.status` via Product Core API (Workflow does not own Product table writes for status — **or** owns status field exclusively; pick one)

**Decision:** Workflow service owns `Product.status` transitions; Product Core owns all other product fields. Status updates go through Workflow API only.

#### Dependencies
- Product Core
- Import and Validation (publish-ready guard)

#### Database Tables (Sprint 4)

| Table | Owner |
|-------|-------|
| `WorkflowEvent` | Workflow |
| `ApprovalRecord` | Workflow |

`Product.status` column owned by Product Core schema, mutated only via Workflow service module.

#### Required APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/products/:id/submit` | Draft → In Review |
| POST | `/v1/products/:id/approve` | In Review → Approved |
| POST | `/v1/products/:id/reject` | → Draft + reason |
| POST | `/v1/products/:id/request-changes` | → Draft |
| POST | `/v1/products/:id/mark-publish-ready` | Approved → Publish Ready (runs validation) |
| GET | `/v1/products/:id/workflow` | History + current state |

#### Required Jobs
- `workflow.check-publish-ready` — re-evaluate products when `category_attribute_set.changed` or `validation.passed`

#### Events to Emit First
```
product.submitted          { productId, actorId }
product.approved           { productId, approverId }
product.rejected           { productId, reason }
product.publish_ready      { productId }
product.published          { productId }  // emitted when Publishing completes snapshot
```

#### Acceptance Criteria
- [ ] Invalid state transitions return 422
- [ ] Editor cannot approve (RBAC)
- [ ] `PUBLISH_READY` blocked when validation has blocking errors
- [ ] Full workflow history on product
- [ ] Rejection returns product to DRAFT with comment

#### Exposes to Next Service
- `product.publish_ready` event triggers Search reindex + Publishing eligibility
- Stable lifecycle states for Publishing gate

---

### 3.5 Search Projection Service

#### Purpose
Build and maintain OpenSearch read models for browse, filter, and admin list views. PostgreSQL remains source of truth; OpenSearch is disposable and rebuildable.

#### Responsibilities
- Product document projection (resolved attributes, facets, category path, status)
- Incremental index on `product.*` and `facet_rule.changed` events
- Full reindex job
- Facet aggregations for category browse
- Search API (text + facet filters)

#### Inputs
- Events: `product.created`, `product.updated`, `product.attributes_changed`, `product.publish_ready`, `product.published`, `category.updated`, `facet_rule.changed`
- Product Core: resolved `ProductDTO`
- Taxonomy: facet definitions, category path

#### Outputs
- OpenSearch index: `products-{organizationId}` (or single index with tenant filter)
- `SearchProductDTO`, `FacetAggregationDTO`
- Events: `search.indexed`, `search.reindex_completed`

#### Dependencies
- Product Core (source data)
- Taxonomy (facet definitions, category paths)
- Workflow (index `status` for filtering)

#### Database Tables

| Store | Owner | Notes |
|-------|-------|-------|
| OpenSearch `products` index | Search Projection | Denormalized documents |
| `SearchIndexCursor` (PG) | Search Projection | Last processed event offset per tenant (optional) |

No product data duplicated in PG beyond cursor metadata.

#### Document Shape (OpenSearch)
```json
{
  "productId": "uuid",
  "organizationId": "uuid",
  "sku": "SKU-001",
  "title": "...",
  "status": "PUBLISH_READY",
  "primaryCategoryId": "uuid",
  "categoryPath": "/apparel/mens/shirts",
  "attributes": { "color": "Blue", "size": "M" },
  "facets": { "color": "Blue", "size": "M", "brand": "Acme" },
  "updatedAt": "ISO8601"
}
```

#### Required APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/search/products` | Text + facet filter + pagination |
| GET | `/v1/search/facets` | Aggregations for category |
| POST | `/v1/admin/search/reindex` | Full reindex (admin) |

#### Required Jobs (queue first)

| Job | Queue | Trigger |
|-----|-------|---------|
| `search.index-product` | `search` | `product.*` events |
| `search.bulk-reindex` | `search` | Admin command or nightly |
| `search.delete-product` | `search` | `product.deleted` |

#### Events to Emit First
```
search.indexed          { productId, indexVersion }
search.reindex_completed { organizationId, documentCount }
```

#### Acceptance Criteria
- [ ] Product create/update reflected in OpenSearch within 30s (async)
- [ ] Facet filters return correct product sets
- [ ] Full reindex rebuilds from PostgreSQL without data loss
- [ ] Published vs draft products filterable by status
- [ ] OpenSearch failure does not block Product Core writes

#### Exposes to Next Service
- Browse/search API for Admin UI (later)
- Published product filter for Publishing (cross-check)

---

### 3.6 Publishing and Syndication Service

#### Purpose
Create immutable publish snapshots and generate channel-specific export payloads. MVP: one target — custom JSON file to S3.

#### Responsibilities
- Transition `PUBLISH_READY → PUBLISHED` (coordinates with Workflow)
- Create `PublishSnapshot` (full resolved product JSON)
- Channel definition + field mapping (JSON path → export field)
- Export job: filter, transform, write to S3
- MVP: no live Shopify push — file drop only

#### Inputs
- `product.publish_ready` or explicit publish command
- Resolved `ProductDTO` from Product Core
- `AttributeSchemaDTO`, facets from Taxonomy
- Channel mapping config

#### Outputs
- `PublishSnapshotDTO`
- Export artifact in S3 (`exports/{org}/{jobId}/catalog.json`)
- `ExportJobDTO`
- Events: `product.published`, `export.completed`, `export.failed`

#### Dependencies
- Product Core
- Taxonomy
- Workflow (state transition to PUBLISHED)
- Import/Validation (snapshot only if validation passed at publish time)

#### Database Tables (Sprint 6)

| Table | Owner |
|-------|-------|
| `PublishSnapshot` | Publishing |
| `Channel` | Publishing |
| `ChannelFieldMapping` | Publishing |
| `ExportJob` | Publishing |
| `ExportJobResult` | Publishing |

#### Required APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/products/:id/publish` | Create snapshot + set PUBLISHED |
| GET | `/v1/products/:id/snapshots` | List snapshots |
| GET | `/v1/snapshots/:id` | Get immutable snapshot |
| POST/GET | `/v1/channels` | Channel config (MVP: one `CUSTOM_JSON`) |
| POST | `/v1/exports` | Run export job |
| GET | `/v1/exports/:id` | Job status + S3 URL |

#### Required Jobs

| Job | Queue | Trigger |
|-----|-------|---------|
| `publish.create-snapshot` | `publish` | POST `/products/:id/publish` |
| `export.run` | `export` | POST `/exports` |
| `export.delta` | `export` | Phase 2 |

#### Events to Emit First
```
product.published    { productId, snapshotId, version }
export.completed     { exportJobId, channelId, artifactUrl, productCount }
export.failed        { exportJobId, reason }
```

#### Acceptance Criteria
- [ ] Snapshot is immutable after creation
- [ ] Only `PUBLISH_READY` products can be published
- [ ] Export contains only `PUBLISHED` snapshots (or latest snapshot per SKU)
- [ ] Field mapping transforms attributes without code deploy
- [ ] Export job report lists per-SKU success/failure
- [ ] MVP export format: JSON array to S3

#### Exposes to Next Service
- `product.published` → Search index update, Audit, webhooks (Integration layer)
- S3 artifact URL for downstream ecommerce ingestion

---

### 3.7 Audit and Reporting Service

#### Purpose
Append-only audit log for all mutations and operational reporting metrics.

#### Responsibilities
- Subscribe to all domain events; write `AuditLog` entries
- Field-level diff on product updates
- Workflow and import/export event logging
- Basic reports: products by status, import success rate, publish count
- No PII beyond user ID in logs

#### Inputs
- All `product.*`, `import.*`, `export.*`, `workflow.*` events
- HTTP request context (actorId, correlationId) passed via event envelope

#### Outputs
- `AuditLogDTO` (searchable)
- `ReportDTO` (aggregates)
- Events: none (terminal consumer for audit)

#### Dependencies
- All upstream services (event consumer)
- Can ship lightweight audit in Sprint 1 (product writes only) and expand

#### Database Tables (Sprint 7, incremental from Sprint 1)

| Table | Owner |
|-------|-------|
| `AuditLog` | Audit |
| `DailyMetricRollup` | Audit (optional MVP) |

**AuditLog schema:**
`id`, `organizationId`, `entityType`, `entityId`, `action`, `actorId`, `changes` (JSONB), `correlationId`, `createdAt`

#### Required APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/audit` | Search logs (entity, actor, date range) |
| GET | `/v1/products/:id/audit` | Product history |
| GET | `/v1/reports/catalog-summary` | Counts by status |
| GET | `/v1/reports/imports` | Import stats |

#### Required Jobs

| Job | Queue | Trigger |
|-----|-------|---------|
| `audit.write` | `audit` | All domain events (async) |
| `report.rollup-daily` | `report` | Cron midnight |

#### Acceptance Criteria
- [ ] 100% of product mutations have audit entries
- [ ] Field-level diff on update (before/after per field)
- [ ] Audit log is append-only (no update/delete API)
- [ ] Reports reflect correct product counts by status
- [ ] Correlation ID traces import → product → publish in logs

#### Exposes to Next Service
- Audit API for Admin UI
- Compliance export (Phase 2)

---

### 3.8 Integration and Eventing Layer

#### Purpose
Reliable async delivery between services and to external subscribers. Hardens the in-process event bus used during MVP scaffolding.

#### Responsibilities
- Transactional outbox pattern (PG `Outbox` table)
- Outbox poller → BullMQ topic queues
- Event envelope standardization (version, correlationId, causationId)
- Webhook subscriptions (MVP: one endpoint URL per tenant)
- Retry, dead-letter, idempotent consumers
- OpenTelemetry trace propagation across jobs

#### Inputs
- Outbox rows written in same TX as domain writes
- Webhook config per tenant

#### Outputs
- Delivered jobs to service queues
- HTTP webhook POSTs to external URLs
- Events: `webhook.delivered`, `webhook.failed`

#### Dependencies
- All services (producers and consumers)
- Implement **after** core event shapes stabilize (Sprint 8)

#### Database Tables

| Table | Owner |
|-------|-------|
| `Outbox` | Eventing |
| `WebhookSubscription` | Eventing |
| `WebhookDelivery` | Eventing |
| `ProcessedEvent` | Eventing (idempotency) |

#### Required APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST/GET/DELETE | `/v1/webhooks` | Manage subscriptions |
| GET | `/v1/webhooks/:id/deliveries` | Delivery log |
| POST | `/v1/admin/outbox/replay` | Replay dead letters |

#### Required Jobs

| Job | Queue | Trigger |
|-----|-------|---------|
| `outbox.poll` | `system` | Every 1s |
| `webhook.deliver` | `webhook` | Matching event |
| `outbox.cleanup` | `system` | Daily |

#### Event Envelope (standard)
```typescript
{
  eventId: string;          // UUID
  eventType: string;        // product.updated
  eventVersion: 1;
  organizationId: string;
  occurredAt: string;       // ISO8601
  correlationId: string;
  causationId?: string;
  actorId?: string;
  payload: Record<string, unknown>;
}
```

#### Acceptance Criteria
- [ ] Domain write + outbox insert in single transaction
- [ ] At-least-once delivery with idempotent consumers
- [ ] Dead-letter queue for failed jobs after 5 retries
- [ ] Webhook signature (HMAC) on outbound payloads
- [ ] Trace ID flows from API → outbox → worker → OpenSearch

#### Exposes to Next Service
- Reliable delivery for all downstream consumers
- External integration point for ecommerce platforms

---

### 3.9 Admin UI and Operations Console

#### Purpose
Internal web app for catalog managers. Built last when API contracts are stable.

#### Responsibilities
- Product list/detail/edit (calls Product Core + Taxonomy)
- Category and attribute admin
- Import wizard (upload → map → dry-run → commit)
- Workflow actions (submit, approve, reject)
- Publish and export triggers
- Audit log viewer
- Basic dashboard (report APIs)

#### Inputs
- All service REST APIs
- Auth tokens (JWT)

#### Outputs
- None (client only)

#### Dependencies
- **All API services** with stable OpenAPI specs
- Search Projection API for list/browse views
- Auth/RBAC from platform layer

#### Database Tables
- None

#### Required APIs
- Consumes existing APIs only; no new backend

#### Tech
- Next.js App Router, React, TypeScript
- TanStack Query for API state
- Shared `@productinfoman/api-client` generated from OpenAPI

#### Build Order (within UI — after APIs stable)

| Screen | Depends on API |
|--------|----------------|
| Login / tenant switch | Auth |
| Product list | Search + Product |
| Product detail/edit | Product + Taxonomy |
| Category admin | Taxonomy |
| Attribute admin | Taxonomy |
| Import wizard | Import |
| Approval queue | Workflow |
| Publish / export | Publishing |
| Audit viewer | Audit |

#### Acceptance Criteria
- [ ] Full MVP flow completable without raw API calls
- [ ] Import wizard shows dry-run errors before commit
- [ ] Approval queue filters `IN_REVIEW` products
- [ ] Publish blocked in UI when validation errors exist
- [ ] No business logic in UI — all rules server-side

---

## 4. Suggested MVP Cutline

### In MVP

| Area | Scope |
|------|-------|
| Catalog domain | Single tenant catalog, one brand |
| Product types | SIMPLE, PARENT, VARIANT |
| Taxonomy | Full tree + category attribute sets |
| Facets | DIRECT rules only |
| Import | CSV only, one mapping template |
| Validation | Required, type, regex, category-bound |
| Workflow | Single-step approval |
| Search | OpenSearch product index + facet filters |
| Publish | Snapshot + JSON export to S3 |
| Channel | One `CUSTOM_JSON` channel |
| Audit | Product + workflow + import events |
| Eventing | In-process bus → outbox (Sprint 8 before UI) |
| Auth | Email/password + 4 roles |

### Out of MVP

- Bundles, collections
- ERP/supplier connectors
- Shopify live push
- Facet normalization
- Multi-level approval
- Localization
- AI enrichment
- Supplier self-service portal
- SSO

### MVP Definition of Done

A catalog manager can:
1. Define categories and attributes
2. Import 1,000 SKUs via CSV with dry-run
3. Create parent-child variants with inheritance
4. Submit → approve → publish-ready → publish
5. Export JSON catalog to S3
6. Browse/filter products in OpenSearch
7. View audit history per product

---

## 5. Phase 2 and Phase 3 Scope

### Phase 2 — Syndication and Hardening

| Service | Additions |
|---------|-----------|
| Publishing | Shopify connector, delta export, scheduled exports |
| Taxonomy | Facet normalization rules, facet preview |
| Import | JSON bulk API, ERP connector framework, scheduled imports |
| Workflow | Multi-level approval, scheduled publish |
| Integration | Multiple webhooks, event replay UI |
| Search | Suggest/autocomplete, popularity ranking |
| Admin UI | Channel mapping UI, export scheduler |

### Phase 3 — Complex Catalog and Ecosystem

| Service | Additions |
|---------|-----------|
| Product Core | Bundles, collections, relationship types |
| Taxonomy | External taxonomy import (Google categories) |
| Import | Supplier feed connectors, vendor-scoped imports |
| Publishing | Multi-channel orchestration, rollback |
| Audit | Compliance export, retention policies |
| Integration | DAM connector, AI enrichment queue |
| Admin UI | Bundle builder, collection curator |

---

## 6. Cross-Service Event Contract Outline

### Event Catalog (ordered by implementation)

| Phase | Event | Producer | Consumers |
|-------|-------|----------|-----------|
| 1 | `product.created` | Product Core | Audit, Search |
| 1 | `product.updated` | Product Core | Audit, Search |
| 1 | `product.deleted` | Product Core | Audit, Search |
| 1 | `product.attributes_changed` | Product Core | Audit, Search, Validation |
| 2 | `category_attribute_set.changed` | Taxonomy | Validation, Search |
| 2 | `facet_rule.changed` | Taxonomy | Search |
| 3 | `import.completed` | Import | Audit, Report |
| 3 | `validation.failed` | Import | Workflow (blocks publish-ready) |
| 4 | `product.submitted` | Workflow | Audit |
| 4 | `product.approved` | Workflow | Audit |
| 4 | `product.publish_ready` | Workflow | Search, Publishing |
| 6 | `product.published` | Publishing | Audit, Search, Integration |
| 6 | `export.completed` | Publishing | Audit, Integration |

### System of Record Matrix

| Entity | SoR Service | Others |
|--------|-------------|--------|
| Product, SKU, attribute values | Product Core | Search (projection) |
| Category, attributes, facets | Taxonomy | Product (FK only) |
| Validation rules/results | Import/Validation | Workflow (reads) |
| Workflow state | Workflow | Product (status column) |
| Publish snapshot | Publishing | — |
| Channel, export jobs | Publishing | — |
| OpenSearch documents | Search Projection | Rebuildable |
| Audit log | Audit | Append-only |
| Outbox, webhooks | Integration | — |

### Idempotency Keys

| Operation | Key |
|-----------|-----|
| Import upsert | `(organizationId, sku)` |
| Search index | `(organizationId, productId, eventId)` |
| Webhook delivery | `eventId` |
| Export job | `exportJobId` |

---

## 7. Recommended Repository / Folder Structure

```
productinfoman/
├── apps/
│   ├── api/                          # Fastify or NestJS monolith host
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── product-core/
│   │       │   ├── taxonomy/
│   │       │   ├── import-validation/
│   │       │   ├── workflow/
│   │       │   ├── search-projection/
│   │       │   ├── publishing/
│   │       │   ├── audit/
│   │       │   └── integration/
│   │       ├── main.ts
│   │       └── app.module.ts
│   ├── worker/                       # BullMQ consumers
│   │   └── src/
│   │       ├── processors/
│   │       │   ├── import.processor.ts
│   │       │   ├── validation.processor.ts
│   │       │   ├── search.processor.ts
│   │       │   ├── publish.processor.ts
│   │       │   ├── export.processor.ts
│   │       │   ├── audit.processor.ts
│   │       │   └── outbox.processor.ts
│   │       └── main.ts
│   └── web/                          # Next.js — build LAST
│       └── src/
│           ├── app/
│           └── features/
├── packages/
│   ├── contracts/                    # Zod schemas + event types (shared)
│   ├── domain/                       # Pure domain types per service
│   ├── db/                           # Prisma schema + client
│   ├── validation-engine/
│   ├── inheritance-engine/
│   ├── facet-engine/
│   └── api-client/                   # Generated OpenAPI client
├── prisma/
│   ├── schema.prisma                 # All PG tables; modules own sections
│   └── migrations/
├── docs/
│   ├── planning/
│   └── openapi/
├── docker/
│   └── docker-compose.yml            # PG, Redis, OpenSearch, MinIO
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

**Cursor execution tip:** One module per service folder. Shared `packages/contracts` prevents circular imports. Workers import same processors as API modules.

---

## 8. Risks and Assumptions

### Assumptions

| ID | Assumption |
|----|------------|
| A1 | Modular monolith until Phase 2 traffic warrants split |
| A2 | Prisma for ORM (Drizzle acceptable if team prefers) |
| A3 | Fastify over NestJS for lean MVP (NestJS if team prefers DI) |
| A4 | Row-level tenancy (`organizationId`) |
| A5 | Workflow owns `Product.status` transitions exclusively |
| A6 | OpenSearch is rebuildable; never source of truth |
| A7 | MVP export = JSON file to S3, not live API push |
| A8 | Single approval step for MVP |

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Inheritance engine complexity | Delays Import + Workflow | Limit MVP to 2 variant axes; spike in Sprint 2 |
| OpenSearch drift from PG | Stale browse results | Reindex job + `search.indexed` monitoring |
| Event ordering | Duplicate/stale projections | `eventId` idempotency + outbox |
| Validation rule sprawl | Unmaintainable config | Zod + JSON schema for rules; max 20 MVP rules |
| Building UI too early | Rework | Gate UI on OpenAPI version freeze |
| Import format diversity | Scope creep | One CSV template for MVP |

---

## 9. Next Cursor Tasks

Execute in order. Each task = one Cursor session.

### Sprint 1 — Product Core
1. **Scaffold monorepo** — pnpm workspaces, `apps/api`, `apps/worker`, `packages/db`, `packages/contracts`, Docker Compose (PG, Redis).
2. **Prisma schema: Organization + Product tables** — migrate; no other services yet.
3. **Product Core module** — CRUD APIs, Zod schemas, SKU uniqueness, soft delete.
4. **Inheritance engine package** — pure function + unit tests.
5. **Variant APIs** — create child, list children, axis uniqueness check.
6. **Emit in-process events** — `product.*` with typed envelope in `packages/contracts`.
7. **OpenAPI spec** — `/v1/products` routes documented.

### Sprint 2 — Taxonomy and Facet
8. **Prisma: Category + Attribute tables** — migrate; add FK on `Product.primaryCategoryId`.
9. **Taxonomy module** — category tree, attribute definitions, category attribute sets.
10. **Facet engine package** — DIRECT rule only.
11. **Wire Product ↔ Taxonomy** — validate category on assign; schema endpoint.
12. **Events** — `category_attribute_set.changed`, `facet_rule.changed`.

### Sprint 3 — Import and Validation
13. **BullMQ setup** — Redis, `import` + `validation` queues, worker app.
14. **S3/MinIO** — CSV upload endpoint.
15. **Import module** — dry-run, commit, row errors; calls Product Core APIs.
16. **Validation engine** — required, type, regex; `ValidationResult` table.
17. **Bulk JSON import** — `POST /v1/products/bulk`.

### Sprint 4 — Workflow and Approval
18. **Workflow module** — state machine, approval APIs, RBAC middleware.
19. **Publish-ready guard** — integration with ValidationResult.
20. **Workflow events** — `product.submitted`, `product.approved`, `product.publish_ready`.

### Sprint 5 — Search Projection
21. **OpenSearch in Docker Compose** — index template.
22. **Search module** — document mapper, `search.index-product` job.
23. **Search API** — `GET /v1/search/products`, facet aggregations.
24. **Full reindex admin endpoint**.

### Sprint 6 — Publishing and Syndication
25. **PublishSnapshot table + module** — immutable snapshot on publish.
26. **Channel + field mapping** — one CUSTOM_JSON channel.
27. **Export job** — JSON to S3, job report.
28. **Event** — `product.published`, `export.completed`.

### Sprint 7 — Audit and Reporting
29. **Audit module** — subscribe all events, field-level diff.
30. **Audit + report APIs**.
31. **Daily rollup job** (optional).

### Sprint 8 — Integration and Eventing
32. **Outbox table + poller** — replace in-process bus.
33. **Webhook subscription** — one URL per tenant, HMAC signing.
34. **OpenTelemetry** — trace API → outbox → worker.
35. **Dead-letter + replay**.

### Sprint 9 — Admin UI (last)
36. **OpenAPI client generation** — `packages/api-client`.
37. **Next.js scaffold** — auth, layout, API client.
38. **Product list + detail** — Search + Product APIs.
39. **Taxonomy admin screens**.
40. **Import wizard**.
41. **Approval queue + publish/export screens**.
42. **Audit viewer**.

---

## Appendix: Table Creation Order

```
Sprint 1:  Organization, Product, ProductAttributeValue, ProductCategory, ProductMedia, ProductRelationship
Sprint 2:  Category, AttributeGroup, AttributeDefinition, AttributeEnumValue, CategoryAttributeSet,
           CategoryAttributeBinding, FacetDefinition, FacetRule
Sprint 3:  ImportJob, ImportJobRow, ImportMappingTemplate, ValidationRule, ValidationResult
Sprint 4:  WorkflowEvent, ApprovalRecord
Sprint 6:  PublishSnapshot, Channel, ChannelFieldMapping, ExportJob, ExportJobResult
Sprint 7:  AuditLog, DailyMetricRollup
Sprint 8:  Outbox, WebhookSubscription, WebhookDelivery, ProcessedEvent
Sprint 5:  SearchIndexCursor (PG metadata only; index in OpenSearch)
```

## Appendix: Job Queue Introduction Order

```
Sprint 3:  import, validation
Sprint 5:  search
Sprint 6:  publish, export
Sprint 7:  audit, report
Sprint 8:  system (outbox), webhook
```
