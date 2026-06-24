# Phase 9 — Admin UI and Operations Console Spec Alignment

Phase 9 is **implemented** as `apps/admin` — a Next.js 15 operations console wired to
the PIM API via `@productinfoman/api-client`. Public storefront pages are out of scope.

## Stack

Next.js App Router · React 19 · TypeScript · Tailwind CSS · TanStack Query · Zod (available) · ApiClient

## Architecture (ASSUMPTION CHANGEs)

| Brief | Implementation | Notes |
|-------|----------------|-------|
| `packages/ui` shared package | `apps/admin/src/components/` | **ASSUMPTION CHANGE:** UI components live in admin app, not a separate package |
| Split client modules (`productClient`, etc.) | Single `ApiClient` class | Methods grouped by domain in one file |
| OpenAPI-generated client | Hand-written typed client | |
| Real OIDC auth | Header impersonation via `SessionProvider` | `X-Organization-Slug`, `X-User-Email`, `X-Actor-Role` |
| `packages/ui` Form components | Tailwind utility classes (`.input`, `.btn-*`) | |

## Page map

| Brief route | Implemented | Notes |
|-------------|-------------|-------|
| `/admin/dashboard` | ✅ | Uses `getReportsSummary()` |
| `/admin/products` | ✅ | List + filters |
| `/admin/products/[id]` | ✅ | Overview, variants, attributes, workflow |
| `/admin/products/new` | ❌ | **ASSUMPTION CHANGE:** create via API only in MVP |
| `/admin/taxonomy` | ✅ | Hub cards |
| `/admin/taxonomy/categories` | ✅ | Read-only tree |
| `/admin/taxonomy/attributes` | ✅ | Read-only table |
| `/admin/taxonomy/facets` | ✅ | Definitions + rules |
| `/admin/imports` | ✅ | Job list |
| `/admin/imports/[id]` | ✅ | Validate/start + errors |
| `/admin/workflow` | ✅ | Task inbox |
| `/admin/workflow/tasks/[id]` | ✅ | Approve/reject + history |
| `/admin/publishing` | ✅ | Channels + jobs tabs |
| `/admin/publishing/[id]` | ✅ | Items, artifact, mappings, retry |
| `/admin/audit` | ✅ | Filters + detail side panel |
| `/admin/reports` | ✅ | Dashboard, completeness, workflow, imports, publishes |

## API client (`packages/api-client`)

| Brief client | ApiClient methods |
|--------------|-------------------|
| productClient | `listProducts`, `getProduct`, `createProduct`, `updateProduct`, `deleteProduct`, `setProductAttributes`, `listVariants`, `getProductTree` |
| taxonomyClient | `getCategoryTree`, `listCategories`, `listAttributes`, `listAttributeGroups`, `listFacetDefinitions`, `listFacetRules` |
| importClient | `listImports`, `getImport`, `getImportErrors`, `validateImport`, `startImport` |
| workflowClient | `listWorkflowTasks`, `getWorkflowTask`, `getWorkflowHistory`, `submitProduct`, `approveProduct`, `rejectProduct`, `publishProduct` |
| publishingClient | `listChannels`, `listChannelMappings`, `dryRunPublish`, `runPublish`, `listPublishJobs`, `getPublishJob`, `retryPublishJob`, `getPublishArtifactUrl` |
| auditClient | `listAudit`, `getAuditLog`, `getEntityHistory` |
| reportsClient | `getReportsSummary`, `getReportsDashboard`, `getReportsCompleteness`, `getReportsWorkflow`, `getReportsImports`, `getReportsPublishes` |

**ASSUMPTION CHANGE:** `createPublishJob` maps to `dryRunPublish` / `runPublish` (separate endpoints).

## Shared components

| Brief component | Location |
|-----------------|----------|
| SideNav | `AdminSidebar.tsx` |
| TopBar | `AdminHeader.tsx` |
| Table | `DataTable.tsx` |
| StatusChip | `StatusChip.tsx` |
| PageHeader | `AdminShell.tsx` |
| EmptyState / Loading / Error | `States.tsx` |
| Toast notifications | `Toast.tsx` |
| Audit detail panel | `AuditDetailPanel.tsx` |

## Access control (MVP stub)

`lib/roles.ts` — role helpers for button visibility:

| Role | Capabilities |
|------|--------------|
| EDITOR | Edit products, submit for review, imports |
| REVIEWER | Approve/reject workflow tasks |
| OPERATIONS | Imports + publishing |
| ADMIN / CATALOG_MANAGER | Full MVP access |

## Data fetching

All pages use TanStack Query (`useQuery` / `useMutation`) with query invalidation on mutations.

## Tests

| Spec §11 criterion | Test |
|--------------------|------|
| Role-based action visibility | `lib/roles.test.ts` |
| Component rendering | Placeholder `app.test.ts` (package smoke) |

**ASSUMPTION CHANGE:** No RTL component tests yet; role helpers provide workflow interaction coverage.

## Phase 9 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Admin shell and navigation | ✅ |
| Products list + detail wired to backend | ✅ |
| Taxonomy pages (tree, attributes, facets) | ✅ read-only |
| Imports list/detail with validate/start | ✅ |
| Workflow tasks + approve/reject | ✅ |
| Publishing channels/jobs + artifact download | ✅ |
| Audit log + reports visible | ✅ |
| Responsive laptop layout | ✅ |

## Out of scope (documented)

- Import file upload wizard (list/detail only; upload via API)
- Taxonomy CRUD forms (read-only MVP)
- Product create form
- Eventing/outbox admin UI (metrics shown on dashboard/reports summary)
- Global product search bar (list filter by title/SKU only)
