# Admin UI — Operations Console

Production-ready Next.js admin shell for the ecommerce PIM MVP. All screens are API-driven via `@productinfoman/api-client`; no business logic is hardcoded in the UI.

## Quick start

```bash
# From repo root — API on :3001, admin on :3000
pnpm dev:all

# Admin only (requires API running separately)
pnpm dev:admin
```

Set `API_URL` in `apps/admin/.env` (see `.env.example`) when the API is not on `http://localhost:3001`.

## Page map

| Route | Purpose |
|-------|---------|
| `/admin/dashboard` | Operations overview from reports API |
| `/admin/products` | Product list with filters |
| `/admin/products/:id` | Product detail, edit, attributes, workflow actions |
| `/admin/taxonomy` | Taxonomy hub |
| `/admin/taxonomy/categories` | Category tree |
| `/admin/taxonomy/attributes` | Attribute definitions |
| `/admin/taxonomy/facets` | Facet definitions and rules |
| `/admin/imports` | Import job list |
| `/admin/imports/:id` | Job detail, errors, validate/retry |
| `/admin/workflow` | Task inbox |
| `/admin/workflow/tasks/:id` | Task detail, approve/reject |
| `/admin/publishing` | Publish jobs, dry-run, channel mappings |
| `/admin/publishing/:id` | Job detail, artifacts, retry |
| `/admin/audit` | Audit log with filters |
| `/admin/reports` | Completeness, throughput, import/publish success |

## Route structure

```
apps/admin/src/app/
├── layout.tsx              # Root layout + providers
├── page.tsx                # Redirect to /admin/dashboard
└── admin/
    ├── layout.tsx          # AdminShell (sidebar + header)
    ├── dashboard/page.tsx
    ├── products/
    │   ├── page.tsx
    │   └── [id]/page.tsx
    ├── taxonomy/
    │   ├── page.tsx
    │   ├── categories/page.tsx
    │   ├── attributes/page.tsx
    │   └── facets/page.tsx
    ├── imports/
    │   ├── page.tsx
    │   └── [id]/page.tsx
    ├── workflow/
    │   ├── page.tsx
    │   └── tasks/[id]/page.tsx
    ├── publishing/
    │   ├── page.tsx
    │   └── [id]/page.tsx
    ├── audit/page.tsx
    └── reports/page.tsx
```

## Component inventory

| Component | Location | Role |
|-----------|----------|------|
| `AdminShell` | `components/layout/AdminShell.tsx` | Shell wrapper, page header, breadcrumbs |
| `AdminSidebar` | `components/layout/AdminSidebar.tsx` | Primary navigation |
| `AdminHeader` | `components/layout/AdminHeader.tsx` | Org/user/role session controls |
| `DataTable` | `components/ui/DataTable.tsx` | TanStack Table wrapper |
| `StatusChip` | `components/ui/StatusChip.tsx` | Workflow/import/publish status badges |
| `EmptyState` / `LoadingState` / `ErrorState` | `components/ui/States.tsx` | Standard async UI states |

## API bindings

All HTTP calls go through `ApiClient` (`packages/api-client`). The admin app creates a client per session in `lib/session.tsx` with:

- `X-Organization-Slug` — tenant scope
- `X-User-Email` — actor identity (workflow actions)
- `X-Actor-Role` — permission role (workflow actions)

Next.js rewrites `/api/*` to the backend (`next.config.ts`), so the client uses `baseUrl: ""` for same-origin requests.

| UI section | API endpoints |
|------------|---------------|
| Products | `GET/POST/PATCH/DELETE /api/v1/products`, attributes, variants |
| Taxonomy | `/api/v1/categories`, attributes, facet-definitions, facet-rules |
| Imports | `/api/v1/imports`, errors, validate, report |
| Workflow | `/api/v1/workflow/tasks`, submit/approve/reject/publish |
| Publishing | `/api/v1/publishing/channels`, jobs, dry-run, retry, artifacts |
| Audit | `GET /api/v1/audit` |
| Reports | `GET /api/v1/reports/summary` |

## State management

- **TanStack Query** — server state, caching, mutations, refetch after actions
- **Session context** — org/user/role in `localStorage` via `SessionProvider`
- **No global client store** — each page owns local form/filter state

## Reusable UI patterns

1. **List pages** — `PageHeader` + filters + `DataTable` + `LoadingState`/`ErrorState`/`EmptyState`
2. **Detail pages** — breadcrumbs, status chips, action buttons that call mutations
3. **Forms** — controlled inputs with Zod validation where edits are supported
4. **Status** — `StatusChip` maps backend enum values to color-coded labels

## Tests

```bash
pnpm --filter @productinfoman/admin test
pnpm --filter @productinfoman/admin build
```

## Rollout order (implemented)

1. Admin shell and navigation
2. Product list and detail/edit
3. Taxonomy (categories, attributes, facets)
4. Import monitoring
5. Workflow inbox and task actions
6. Publishing jobs and artifacts
7. Audit and reporting
8. Session-based access headers (MVP impersonation)

## Out of scope (MVP)

- Public storefront
- Advanced analytics dashboards
- Real auth/OIDC (uses header-based actor impersonation)
- Import file upload UI (list/detail only; upload via API)
- Product create form (API supports POST; add when needed)
