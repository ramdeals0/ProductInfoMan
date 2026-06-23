# Proposed Repository Structure

TypeScript-first monorepo optimized for modular SaaS development, future service extraction, and clear domain boundaries.

---

## Top-Level Layout

```
productinfoman/
├── apps/
│   ├── api/                    # REST API service (primary backend)
│   ├── worker/                 # Background jobs (import, export, validation)
│   └── web/                    # Admin UI (Phase 1+; not in planning implementation)
├── packages/
│   ├── domain/                 # Domain entities, value objects, invariants
│   ├── application/            # Use cases, command/query handlers
│   ├── infrastructure/         # DB repos, storage, queue, external adapters
│   ├── validation-engine/      # Rule evaluation (config-driven)
│   ├── inheritance-engine/     # Parent-child attribute resolution
│   ├── facet-engine/           # Facet derivation rules
│   ├── shared/                 # Types, utils, constants, errors
│   ├── config/                 # ESLint, TSConfig, shared tooling
│   └── sdk/                    # Generated API client (future)
├── prisma/
│   ├── schema.prisma           # Database schema (persistence model)
│   ├── migrations/
│   └── seed.ts
├── docs/
│   ├── planning/               # This planning artifact set
│   ├── adr/                    # Architecture Decision Records
│   └── api/                    # OpenAPI specs
├── scripts/
│   ├── dev.sh
│   └── seed-demo.ts            # Optional; not for production
├── .github/
│   └── workflows/              # CI/CD
├── docker/
│   ├── docker-compose.yml      # Local Postgres, Redis, MinIO
│   └── Dockerfile.api
├── package.json                # Workspace root (pnpm/npm workspaces)
├── pnpm-workspace.yaml
├── turbo.json                  # Optional: Turborepo task orchestration
├── prisma.config.ts
└── README.md
```

---

## App Modules

### `apps/api`

```
apps/api/
├── src/
│   ├── main.ts                 # Server bootstrap
│   ├── routes/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── attributes/
│   │   ├── facets/
│   │   ├── imports/
│   │   ├── exports/
│   │   ├── workflow/
│   │   └── admin/
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── tenant.ts
│   │   └── permissions.ts
│   └── openapi/                # Route → OpenAPI generation
└── package.json
```

**Responsibility:** HTTP transport, auth, request validation, response serialization. No business logic — delegates to `packages/application`.

### `apps/worker`

```
apps/worker/
├── src/
│   ├── main.ts
│   ├── jobs/
│   │   ├── import-csv.job.ts
│   │   ├── validate-product.job.ts
│   │   ├── compute-facets.job.ts
│   │   └── export-channel.job.ts
│   └── queues/
└── package.json
```

**Responsibility:** Async processing, retries, idempotent job handlers.

### `apps/web` (Later)

```
apps/web/
├── src/
│   ├── app/                    # Next.js or similar
│   ├── features/
│   │   ├── products/
│   │   ├── taxonomy/
│   │   ├── attributes/
│   │   ├── imports/
│   │   └── workflow/
│   └── components/
└── package.json
```

**Responsibility:** Admin UI for catalog managers. Not built in planning phase.

---

## Package Modules

### `packages/domain`

Pure domain logic — no framework dependencies.

```
packages/domain/
├── src/
│   ├── product/
│   │   ├── product.entity.ts
│   │   ├── product-type.enum.ts
│   │   └── product-status.enum.ts
│   ├── category/
│   ├── attribute/
│   ├── facet/
│   ├── workflow/
│   ├── validation/
│   ├── publishing/
│   └── shared/
│       └── tenant-scoped.entity.ts
└── package.json
```

### `packages/application`

Use cases orchestrating domain + infrastructure ports.

```
packages/application/
├── src/
│   ├── products/
│   │   ├── create-product.command.ts
│   │   ├── update-product.command.ts
│   │   ├── get-product.query.ts
│   │   └── list-products.query.ts
│   ├── variants/
│   │   └── resolve-inheritance.query.ts
│   ├── workflow/
│   │   ├── submit-for-review.command.ts
│   │   └── approve-product.command.ts
│   ├── validation/
│   │   └── run-validation.command.ts
│   ├── imports/
│   │   └── process-import.command.ts
│   └── ports/                  # Interfaces for repos, queue, storage
└── package.json
```

### `packages/infrastructure`

Adapters implementing application ports.

```
packages/infrastructure/
├── src/
│   ├── persistence/
│   │   ├── prisma/
│   │   │   ├── product.repository.ts
│   │   │   ├── category.repository.ts
│   │   │   └── audit.repository.ts
│   │   └── mappers/            # Domain ↔ Prisma model
│   ├── storage/
│   │   └── s3-import.storage.ts
│   ├── queue/
│   │   └── bullmq.queue.ts
│   └── auth/
│       └── jwt.auth.ts
└── package.json
```

### Rule Engines (Isolated for Config-Driven Logic)

```
packages/validation-engine/
├── src/
│   ├── rule-types/
│   ├── evaluator.ts
│   └── schemas/                # JSON schema for rule config
└── package.json

packages/inheritance-engine/
├── src/
│   ├── resolver.ts
│   └── merge-strategy.ts
└── package.json

packages/facet-engine/
├── src/
│   ├── direct-rule.ts
│   └── facet-computer.ts
└── package.json
```

---

## Documentation Conventions

```
docs/
├── planning/           # Product & domain planning (current)
├── adr/
│   ├── 001-monorepo-structure.md
│   ├── 002-postgresql-choice.md
│   └── 003-publish-snapshot-model.md
└── api/
    └── openapi.yaml
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Persistence schema (not identical to domain model) |
| `prisma.config.ts` | Prisma 7 datasource config |
| `turbo.json` | Monorepo build pipeline |
| `docker/docker-compose.yml` | Local Postgres, Redis, MinIO |
| `.env.example` | Environment template |

---

## Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Domain entities | PascalCase | `Product`, `AttributeDefinition` |
| API routes | kebab-case plural | `/api/v1/products` |
| DB tables | PascalCase (Prisma default) | `Product`, `Category` |
| Attribute keys | snake_case | `color`, `screen_size` |
| Event names | dot.notation | `product.published` |
| Job names | kebab-case | `import-csv` |

---

## Module Boundary Rules

1. `domain` imports nothing from `infrastructure` or `apps`
2. `application` imports `domain`; defines ports only
3. `infrastructure` implements ports; imports `application` ports + `domain`
4. `apps/*` imports `application`; wires DI container
5. Rule engines are pure functions with JSON config inputs
6. No channel-specific logic in `domain` or `application`

---

## Current vs Target State

| Path | Current | Target |
|------|---------|--------|
| `prisma/schema.prisma` | Minimal Product model | Full persistence model per domain |
| `src/lib/prisma.ts` | Client singleton | Move to `packages/infrastructure` |
| `apps/api` | Not present | Phase 1 E1 |
| `packages/domain` | Not present | Phase 1 E1 |
| `docs/planning/` | Being created | Foundation docs |

Migration from current scaffold to target structure is planned for Epic E1.
