# ProductInfoMan

High-performance ecommerce Product Information Management (PIM) platform.

## Status

| Phase | Status |
|-------|--------|
| Phase 0 — Planning | Complete ([docs/planning/](./docs/planning/)) |
| Phase 1 — Product Core | **Implemented** ([spec alignment](./docs/implementation/phase-1-product-core-spec.md)) |
| Phases 2–8 | Planned ([docs/implementation/](./docs/implementation/)) |

## Stack

Next.js (Phase 8) · Fastify · PostgreSQL · Redis/BullMQ · OpenSearch · S3 · Zod · Prisma

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
Health: `GET /health`  
Products: `GET /api/v1/products`

Header: `X-Organization-Slug: demo` (default)

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
