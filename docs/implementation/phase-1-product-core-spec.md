# Phase 1 — Product Core Spec Alignment

This document maps the Phase 1 implementation brief to the code in this repository.
Phase 1 is **implemented**; later phases (2–8) build on top of it.

## Stack choices (locked)

| Brief | Implementation |
|-------|----------------|
| NestJS or Fastify | **Fastify** (`apps/api`) |
| Prisma or Drizzle | **Prisma** (`prisma/schema.prisma`, `packages/db`) |
| Zod | **Zod** (`packages/validation`) |

## Repo structure

```
apps/
  api/                    # Fastify REST API, Product Core module
packages/
  db/                     # Prisma client + pg pool
  domain/                 # Framework-agnostic TypeScript types
  validation/             # Zod input/query schemas
  shared/                 # writeAudit, AppError, helpers
  inheritance-engine/     # Variant attribute resolution (read-time)
  contracts/              # Domain events
```

## Schema mapping (ASSUMPTION CHANGEs)

The brief proposes separate `products` + `product_variants` tables. This repo uses a **single `Product` table** with self-referential parent/child links — aligned with `docs/planning/03-domain-model.md`.

| Brief table / field | Implementation | Notes |
|---------------------|----------------|-------|
| `products.external_id` | `Product.sku` | **ASSUMPTION CHANGE:** `sku` is the tenant-scoped business identifier (unique per org). |
| `products.name` | `Product.title` | **ASSUMPTION CHANGE:** `title` used for display name. |
| `products.status` `draft\|active\|inactive` | `ProductStatus` enum | **ASSUMPTION CHANGE:** workflow-ready lifecycle (`DRAFT`, `IN_REVIEW`, `APPROVED`, …). MVP starts in `DRAFT`. |
| `product_variants` table | `Product` where `productType = VARIANT` | Variants are rows with `parentId` → parent `Product`. |
| `variant_sku` | `Product.sku` on variant rows | Unique per organization. |
| `attributes` | `AttributeDefinition` | Tenant-scoped; `key` = machine code. |
| `attribute_group_attributes` | `AttributeDefinition.attributeGroupId` | Direct FK instead of join table. |
| `product_attribute_values` typed columns | `ProductAttributeValue.value` (JSON) | **ASSUMPTION CHANGE:** single JSON column + `dataType` on definition. |
| `product_relationships` | `ProductRelationship` | Written on variant create (`VARIANT_OF`); no standalone CRUD API in Phase 1. |
| `audit_logs` | `AuditLog` | `entityType`, `entityId`, `action`, `changes` JSON, `actorId`. |
| — | `Organization` (tenant) | **ASSUMPTION CHANGE:** all entities are multi-tenant via `organizationId`. |

Migrations: `prisma/migrations/` + `pnpm db:push` for dev.

## Domain types (`packages/domain`)

| Brief type | Export |
|------------|--------|
| Product | `ProductEntity`, `ProductTreeNode` |
| ProductVariant | Represented as `ProductEntity` with `productType: "VARIANT"` |
| Category | `CategoryEntity`, `CategoryTreeNode` |
| Attribute | `AttributeEntity` |
| AttributeGroup | `AttributeGroupEntity` |
| ProductAttributeValue | `ResolvedAttribute` (API response shape) |
| ProductRelationship | `ProductRelationshipType` + schema model |

## Validation (`packages/validation`)

| Brief schema | Zod export |
|--------------|------------|
| CreateProductInput | `CreateProductSchema` |
| UpdateProductInput | `UpdateProductSchema` |
| CreateVariantInput | `CreateVariantSchema` |
| CreateCategoryInput | `CreateCategorySchema` |
| CreateAttributeInput | `CreateAttributeSchema` |
| CreateAttributeGroupInput | `CreateAttributeGroupSchema` |

## API endpoints

Base: `/api/v1` · Header: `X-Organization-Slug: demo`

### Products (`apps/api/src/modules/product-core/`)

| Brief | Implemented |
|-------|-------------|
| POST /products | ✓ |
| GET /products/:id | ✓ (includes resolved attributes) |
| PATCH /products/:id | ✓ |
| POST /products/:id/variants | ✓ `POST /products/:parentId/variants` |
| GET /products/:id/tree | ✓ |
| GET /products (pagination) | ✓ |
| — | DELETE /products/:id, PUT /products/:id/attributes, GET /products/:id/variants |

### Taxonomy (`apps/api/src/modules/taxonomy/`)

| Brief | Implemented |
|-------|-------------|
| POST /categories | ✓ |
| GET /categories | ✓ (+ GET /categories/tree) |
| POST /attributes | ✓ |
| GET /attributes | ✓ |
| POST /attribute-groups | ✓ |
| GET /attribute-groups | ✓ |

## Variant inheritance

Read-time resolution in `packages/inheritance-engine` + `product.service.ts`:

1. Load parent stored attribute values.
2. Overlay variant values.
3. Mark sources: `INHERITED`, `LOCAL`, `OVERRIDDEN`.
4. Core fields (`brand`, `title`, `description`) participate when in effective schema.

## Audit logging

`writeAudit()` in `packages/shared` — called on product **create** and **update**.
Emits `audit.record.created` integration event.

## Tests

`apps/api/src/__tests__/product-core.test.ts` — covers Phase 1 acceptance cases.
`packages/inheritance-engine/src/index.test.ts` — unit tests for resolution logic.

Run:

```bash
pnpm --filter @productinfoman/api test -- src/__tests__/product-core.test.ts
```

## Deliverables checklist

- [x] Database schema + migrations
- [x] Product + variant CRUD
- [x] Category / attribute / attribute-group endpoints (minimal)
- [x] Product tree with inheritance view
- [x] Audit logs on product writes
- [x] Tests for uniqueness, tree, inheritance

## Out of scope (later phases)

Imports, facets/search, workflow/approvals, publishing, admin UI — implemented in Phases 2–8 but not part of this brief.
