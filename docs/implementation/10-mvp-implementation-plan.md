# MVP Implementation Plan

> **Status:** Active — Phase 1 in progress  
> **Stack:** Next.js, Fastify, PostgreSQL, Redis/BullMQ, OpenSearch, S3, Zod, Prisma, OpenTelemetry

---

## MVP Summary

Build a governed PIM for one catalog domain (Apparel) with parent/variant products, category-driven attributes, DIRECT facet rules, CSV import, single-step approval, JSON export to S3, OpenSearch browse, and audit trail. Admin UI shell last.

| Constraint | MVP value |
|------------|-----------|
| Catalog domain | Apparel (`/apparel/mens/shirts`) |
| Product types | SIMPLE, PARENT, VARIANT |
| Import | CSV, upsert by SKU |
| Approval | Draft → Review → Approved → Publish Ready → Published |
| Export | `CUSTOM_JSON` → S3 |
| Facets | DIRECT attribute mapping |
| Tenancy | Single org (`demo`) |

---

## Service-by-Service Build Order

| Phase | Service | Sprint | Depends on |
|-------|---------|--------|------------|
| 1 | Product Core | S1 | — |
| 2 | Taxonomy & Facet | S2 | Product Core |
| 3 | Import & Validation | S3 | Product, Taxonomy |
| 4 | Workflow & Approval | S4 | Product, Validation |
| 5 | Search Projection | S5 | Product, Taxonomy, Workflow |
| 6 | Publishing & Syndication | S6 | Workflow, Product |
| 7 | Audit & Reporting | S7 | All events |
| 8 | Admin UI Shell | S8 | All APIs stable |

---

## 1. Database Schema Plan

### Phase 1 tables (create first)

| Table | Purpose | SoR |
|-------|---------|-----|
| `Organization` | Tenant | Platform |
| `User` | Actor | Platform |
| `Product` | Master record, SKU, status, parentId | Product Core |
| `ProductAttributeValue` | EAV values + inheritance source | Product Core |
| `ProductCategory` | Secondary categories | Product Core |
| `ProductMedia` | URL refs | Product Core |
| `Category` | Taxonomy tree | Taxonomy |
| `AttributeGroup` | Logical grouping | Taxonomy |
| `AttributeDefinition` | Typed schema | Taxonomy |
| `AttributeEnumValue` | LOV | Taxonomy |
| `CategoryAttributeSet` | Per-category bindings | Taxonomy |
| `CategoryAttributeBinding` | Required/optional/hidden | Taxonomy |
| `FacetDefinition` | Facet config | Taxonomy |
| `FacetRule` | DIRECT/normalize rules | Taxonomy |
| `AuditLog` | Append-only history | Audit |

### Phase 3–7 tables (schema stub in Phase 1 migration)

| Table | Phase |
|-------|-------|
| `ImportJob`, `ImportJobRow`, `ImportMappingTemplate` | 3 |
| `ValidationRule`, `ValidationResult` | 3 |
| `WorkflowEvent`, `ApprovalRecord` | 4 |
| `PublishSnapshot`, `Channel`, `ChannelFieldMapping`, `ExportJob`, `ExportJobResult` | 6 |
| `Outbox`, `WebhookSubscription` | 7 |

### Key indexes

```sql
UNIQUE (organizationId, sku) WHERE deletedAt IS NULL
INDEX (organizationId, status)
INDEX (organizationId, parentId)
UNIQUE (productId, attributeDefinitionId)
INDEX (organizationId, path) ON Category
```

---

## 2. API Contract Plan

Base: `/api/v1` · Auth: Bearer JWT · Tenant: `organizationId` from token

### Phase 1 — Product Core

| Method | Path | Description |
|--------|------|-------------|
| POST | `/products` | Create product |
| GET | `/products` | List (filter: status, type, sku, title) |
| GET | `/products/:id` | Get resolved product + attributes |
| PATCH | `/products/:id` | Update core fields |
| DELETE | `/products/:id` | Soft delete |
| PUT | `/products/:id/attributes` | Batch set attribute values |
| POST | `/products/:parentId/variants` | Create variant child |
| GET | `/products/:parentId/variants` | List variants |

### Phase 2 — Taxonomy & Facet

| Method | Path |
|--------|------|
| CRUD | `/categories`, `/categories/tree` |
| PUT | `/categories/:id/attribute-set` |
| GET | `/categories/:id/attribute-schema` |
| CRUD | `/attributes`, `/attribute-groups` |
| CRUD | `/facets` |
| GET | `/products/:id/facets` |

### Phase 3 — Import & Validation

| Method | Path |
|--------|------|
| POST | `/imports` |
| POST | `/imports/:id/dry-run` |
| POST | `/imports/:id/commit` |
| GET | `/imports/:id` |
| POST | `/products/bulk` |
| POST | `/products/:id/validate` |

### Phase 4 — Workflow

| Method | Path |
|--------|------|
| POST | `/products/:id/submit` |
| POST | `/products/:id/approve` |
| POST | `/products/:id/reject` |
| POST | `/products/:id/mark-publish-ready` |
| GET | `/products/:id/workflow` |

### Phase 5 — Search

| Method | Path |
|--------|------|
| GET | `/search/products` |
| GET | `/search/facets` |
| POST | `/admin/search/reindex` |

### Phase 6 — Publishing

| Method | Path |
|--------|------|
| POST | `/products/:id/publish` |
| GET | `/products/:id/snapshots` |
| POST | `/exports` |
| GET | `/exports/:id` |
| CRUD | `/channels` |

### Phase 7 — Audit

| Method | Path |
|--------|------|
| GET | `/audit` |
| GET | `/products/:id/audit` |
| GET | `/reports/catalog-summary` |

DTO schemas live in `packages/contracts` (Zod).

---

## 3. Event Contract Plan

### Envelope

```typescript
interface DomainEvent {
  eventId: string;
  eventType: string;
  eventVersion: 1;
  organizationId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  actorId?: string;
  payload: Record<string, unknown>;
}
```

### Events by phase

| Phase | Events |
|-------|--------|
| 1 | `product.created`, `product.updated`, `product.deleted`, `product.attributes_changed` |
| 2 | `category.updated`, `category_attribute_set.changed`, `facet_rule.changed` |
| 3 | `import.started`, `import.completed`, `validation.passed`, `validation.failed` |
| 4 | `product.submitted`, `product.approved`, `product.rejected`, `product.publish_ready` |
| 5 | `search.indexed`, `search.reindex_completed` |
| 6 | `product.published`, `export.completed`, `export.failed` |
| 7 | All events → `audit.written` |

Delivery: in-process EventEmitter (Phases 1–6) → outbox + BullMQ (Phase 7).

---

## 4. Folder / Repo Structure

```
productinfoman/
├── apps/
│   ├── api/                    # Fastify REST API
│   ├── worker/                 # BullMQ (Phase 3+)
│   └── web/                    # Next.js (Phase 8)
├── packages/
│   ├── contracts/              # Zod DTOs + event types
│   ├── inheritance-engine/     # Parent-child resolver
│   ├── validation-engine/      # Phase 3
│   └── facet-engine/           # Phase 2
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docker/docker-compose.yml
├── docs/
│   ├── planning/
│   └── implementation/         # This doc
├── package.json
└── pnpm-workspace.yaml
```

---

## 5. Sprint-by-Sprint Breakdown

### Sprint 1 — Phase 1: Product Core ✓ (current)

- [x] Monorepo + Docker Compose (PG, Redis)
- [ ] Full canonical Prisma schema + migration
- [ ] Fastify API + Product CRUD
- [ ] Inheritance engine + variant APIs
- [ ] Seed: Apparel parent + 3 variants
- [ ] `product.*` events (in-process)

**Acceptance:** Create parent + variants via API; GET returns resolved attributes with inheritance tags.

### Sprint 2 — Phase 2: Taxonomy & Facet

- Category tree CRUD + seed categories
- Attribute groups/definitions + category attribute sets
- Facet definitions (DIRECT) + `GET /products/:id/facets`
- Wire `primaryCategoryId` validation

**Acceptance:** Category-specific facets generated from product attributes.

### Sprint 3 — Phase 3: Import & Validation

- BullMQ worker app
- MinIO CSV upload
- Dry-run + commit import jobs
- Validation engine (required, type, variant rules)

**Acceptance:** Bad CSV rows blocked; async job with error report.

### Sprint 4 — Phase 4: Workflow & Approval

- State machine + RBAC
- Publish-ready guard (validation)
- Workflow history API

**Acceptance:** Cannot publish without approval + validation pass.

### Sprint 5 — Phase 5: Search Projection

- OpenSearch index template
- Index approved/published products only
- Search + facet aggregation APIs
- Reindex job

**Acceptance:** Browse/filter from OpenSearch.

### Sprint 6 — Phase 6: Publishing

- PublishSnapshot (immutable)
- CUSTOM_JSON channel + field mapping
- Async export job → S3

**Acceptance:** Published products export to S3 JSON.

### Sprint 7 — Phase 7: Audit & Reporting

- Audit consumer for all events
- Field-level diffs
- Catalog summary report

**Acceptance:** Every change traceable by user + timestamp.

### Sprint 8 — Phase 8: Admin UI Shell

- Next.js app + API client
- Product list/detail, taxonomy, import wizard, approval queue, publish status

**Acceptance:** End-to-end MVP without raw API calls.

---

## 6. Service Specifications (Summary)

See [08-service-implementation-roadmap.md](../planning/08-service-implementation-roadmap.md) for full detail per service.

---

## Exact First Implementation Ticket

**Ticket: PIM-001 — Phase 1 Product Core Foundation**

```
Title: Scaffold monorepo and implement Product Core CRUD with variants

Tasks:
1. Add pnpm workspaces, apps/api (Fastify), packages/contracts, packages/inheritance-engine
2. Add docker-compose.yml (PostgreSQL 16, Redis 7)
3. Replace SQLite schema with full PostgreSQL canonical schema (Phase 1 tables)
4. Implement POST/GET/PATCH/DELETE /api/v1/products
5. Implement POST /products/:parentId/variants, GET variants
6. Implement PUT /products/:id/attributes with inheritance resolution on GET
7. Add seed: Organization demo, Category apparel/shirts, Parent SHIRT-001 + 3 variants
8. Add integration test or script verifying acceptance criteria

Acceptance:
- curl POST parent → 201
- curl POST 3 variants → 201
- curl GET parent variants → 3 children
- curl GET variant → attributes show inherited vs local source
- SKU duplicate → 409

Files:
- prisma/schema.prisma
- apps/api/src/**
- packages/contracts/src/**
- packages/inheritance-engine/src/**
- docker/docker-compose.yml
- prisma/seed.ts
```

---

## Phase 2+ Scope (Post-MVP)

| Feature | Phase |
|---------|-------|
| Facet normalization | 2+ |
| Shopify connector | 2+ |
| Multi-level approval | 2+ |
| Bundles/collections | 3+ |
| AI enrichment | 4+ |
| Localization | 3+ |
| Multi-tenant billing | Never in MVP |
