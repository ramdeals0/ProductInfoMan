# MVP Implementation

| Document | Description |
|----------|-------------|
| [10-mvp-implementation-plan.md](./10-mvp-implementation-plan.md) | Full MVP blueprint |

## Phase Status

| Phase | Service | Status |
|-------|---------|--------|
| 1 | Product Core | **Done** — CRUD, variants, inheritance, seed |
| 2 | Taxonomy & Facet | Planned |
| 3 | Import & Validation | Planned |
| 4 | Workflow & Approval | Planned |
| 5 | Search Projection | Planned |
| 6 | Publishing & Syndication | Planned |
| 7 | Audit & Reporting | Planned |
| 8 | Admin UI Shell | Planned |

## Quick Start (Phase 1)

```bash
# Start PostgreSQL (Docker or Prisma dev)
pnpm docker:up          # or: npx prisma dev -d

# Configure .env (see .env.example)
cp .env.example .env

# Schema + seed
pnpm db:push            # or: pnpm db:migrate
pnpm db:seed

# API
pnpm dev                # http://localhost:3001
curl http://localhost:3001/health
curl http://localhost:3001/api/v1/products?productType=PARENT
```
