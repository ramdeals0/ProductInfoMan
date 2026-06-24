# ProductInfoMan

High-performance ecommerce Product Information Management (PIM) platform.

## Status

| Phase | Status |
|-------|--------|
| Phase 0 — Planning | Complete ([docs/planning/](./docs/planning/)) |
| Phase 1 — Product Core | **Implemented** ([spec alignment](./docs/implementation/phase-1-product-core-spec.md)) |
| Phase 2 — Taxonomy/Facets | **Implemented** ([spec alignment](./docs/implementation/phase-2-taxonomy-facet-spec.md)) |
| Phase 3 — Import/Validation | **Implemented** ([spec alignment](./docs/implementation/phase-3-import-validation-spec.md)) |
| Phase 4 — Workflow/Approval | **Implemented** ([spec alignment](./docs/implementation/phase-4-workflow-approval-spec.md)) |
| Phase 5 — Search Projection | **Implemented** ([spec alignment](./docs/implementation/phase-5-search-projection-spec.md)) |
| Phase 6 — Publishing/Syndication | **Implemented** ([spec alignment](./docs/implementation/phase-6-publishing-syndication-spec.md)) |
| Phase 7 — Audit/Reporting | **Implemented** ([spec alignment](./docs/implementation/phase-7-audit-reporting-spec.md)) |
| Phase 8 — Integration/Eventing | **Implemented** ([spec alignment](./docs/implementation/phase-8-integration-eventing-spec.md)) |
| Phase 9 — Admin UI | **Implemented** ([spec alignment](./docs/implementation/phase-9-admin-ui-spec.md), [admin README](./apps/admin/README.md)) |
| Phase 11 — Headless Storefront | **Implemented** ([spec alignment](./docs/implementation/phase-11-storefront-spec.md)) |
| Product MDM Layer | **Implemented** ([spec alignment](./docs/implementation/product-mdm-layer-spec.md)) |
| Fleet Farm Demo Catalog | **Implemented** ([spec](./docs/implementation/fleetfarm-demo-catalog-spec.md)) |
| Developer Portal | **Implemented** ([apps/devportal](./apps/devportal/README.md)) |

## Deploy on Railway

See **[docs/deployment/railway.md](./docs/deployment/railway.md)** for Postgres + API + Admin + Storefront setup.

**Production API:** `https://pim-api.up.railway.app` — see **[docs/deployment/railway-production.md](./docs/deployment/railway-production.md)** for exact variables and verify steps.

## Quick Start

```bash
pnpm install
cp .env.example .env

# PostgreSQL — option A: Docker
pnpm docker:up

# PostgreSQL — option B: Prisma dev (no Docker)
npx prisma dev -d
# Copy DATABASE_URL from: npx prisma dev ls

pnpm db:push
pnpm db:seed
pnpm dev
```

API: http://localhost:3001  
Admin: http://localhost:3000  
Storefront: http://localhost:3002  
Developer Portal: http://localhost:3003  
Health: `GET /health`  
Products: `GET /api/v1/products`

Header: `X-Organization-Slug: demo` (default)

## User guide

End-user documentation for the Admin console, storefront, roles, and workflows:

**[docs/user-guide.md](./docs/user-guide.md)**

## Phase 1 API

| Method | Path |
|--------|------|
| POST | `/api/v1/products` |
| GET | `/api/v1/products` |
| GET | `/api/v1/products/:id` |
| PATCH | `/api/v1/products/:id` |
| DELETE | `/api/v1/products/:id` |
| PUT | `/api/v1/products/:id/attributes` |
| POST | `/api/v1/products/:parentId/variants` |
| GET | `/api/v1/products/:parentId/variants` |

## License

ISC
