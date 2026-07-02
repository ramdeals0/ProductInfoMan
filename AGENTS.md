# AGENTS.md

## Cursor Cloud specific instructions

ProductInfoMan is a pnpm workspace monorepo (a PIM + headless storefront). The
update script already runs `pnpm install` and `pnpm db:generate` on startup, so
the Prisma client (`generated/prisma`, gitignored) and node_modules are present.
The notes below cover the non-obvious startup steps that the update script does
**not** perform.

### Services / ports
| Service | Dir | Port | Run (dev) |
|---------|-----|------|-----------|
| API (Fastify) | `apps/api` | 3001 | `pnpm dev` |
| Admin (Next.js) | `apps/admin` | 3000 | `pnpm dev:admin` |
| Storefront (Next.js) | `apps/storefront` | 3002 | `pnpm dev:storefront` |
| Devportal (Next.js docs) | `apps/devportal` | 3003 | `pnpm dev:devportal` |

Only PostgreSQL is required. Redis, OpenSearch and MinIO are all optional: with
`REDIS_URL` unset the background queues run inline (sync mode), and with
`OPENSEARCH_URL` unset search falls back to the Postgres store.

### PostgreSQL (must be started manually each session)
Postgres 16 is installed as a system cluster; the update script cannot start it.
Start it and (only on a fresh DB) load the schema + demo data:
```bash
sudo pg_ctlcluster 16 main start          # start Postgres (idempotent)
pnpm db:push                              # sync schema (first time / after schema changes)
pnpm db:seed                              # load demo org, taxonomy, catalog
```
Local superuser: `postgres` / `postgres` on `localhost:5432`, DB `productinfoman`.

### Environment files (not committed; recreate if missing)
- Root `.env`: `cp .env.example .env`, then **unset `REDIS_URL` and
  `OPENSEARCH_URL`** (comment them out) and set the four `*_SYNC` flags to
  `"true"` so the API runs without Redis/OpenSearch.
- `apps/admin/.env.local`: must set `API_URL=http://localhost:3001` and a
  `JWT_SECRET` that is **identical to the API's `JWT_SECRET`** (otherwise admin
  login tokens fail to verify).
- `apps/storefront/.env.local`: `API_URL`/`NEXT_PUBLIC_API_URL=http://localhost:3001`,
  `NEXT_PUBLIC_ORG_SLUG=demo`.

All API calls require the `X-Organization-Slug: demo` header. Admin/storefront
proxy `/api/v1/*` to the API via Next rewrites.

### Demo login
`admin@demo.local` / `Admin123!@#demo` (org slug `demo`).

### Products are created via Import, not a manual form
The Admin UI has **no "New Product" button** — products are created by uploading
CSV/JSON/XML through the Imports section, or via `POST /api/v1/products` with a
Bearer token. Don't look for a create-product form in the UI.

### Testing / lint / build gotchas
- Tests: `pnpm test` (per-package `pnpm --filter @productinfoman/<pkg> test`).
  The `@productinfoman/api` package currently has ~5 pre-existing failing tests
  (JWT TTL and search-projection facet assertions) whose expectations disagree
  with the documented `.env` values; these are unrelated to environment setup.
- Lint: `next lint` in the Next apps is **not configured** (no ESLint config in
  the repo) and drops into an interactive setup prompt, so it is non-functional.
  Use TypeScript as the static check instead.
- Build: `apps/api`'s `tsc` build (`pnpm --filter @productinfoman/api build`) has
  pre-existing type errors, but this is not the runtime path — both dev
  (`tsx watch`) and Railway prod (`start:railway: tsx src/main.ts`) run via `tsx`.
