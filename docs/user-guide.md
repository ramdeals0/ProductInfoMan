# ProductInfoMan User Guide

ProductInfoMan is a Product Information Management (PIM) platform for ecommerce teams. It centralizes product data, enforces an approval workflow, powers faceted search, syndicates catalog exports to sales channels, and exposes a headless storefront for shoppers.

This guide covers day-to-day use of the **Admin console**, **Storefront**, and key concepts shared by both.

---

## Table of contents

1. [Applications and URLs](#1-applications-and-urls)
2. [Signing in](#2-signing-in)
3. [Roles and permissions](#3-roles-and-permissions)
4. [Product lifecycle](#4-product-lifecycle)
5. [Admin console overview](#5-admin-console-overview)
6. [Managing products](#6-managing-products)
7. [Taxonomy (categories, attributes, facets)](#7-taxonomy-categories-attributes-facets)
8. [Bulk imports](#8-bulk-imports)
9. [Workflow and approvals](#9-workflow-and-approvals)
10. [Publishing to channels](#10-publishing-to-channels)
11. [Search and the storefront](#11-search-and-the-storefront)
12. [Master data (MDM)](#12-master-data-mdm)
13. [Audit and reports](#13-audit-and-reports)
14. [Users and security (administrators)](#14-users-and-security-administrators)
15. [Glossary](#15-glossary)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Applications and URLs

| Application | Default URL (local) | Who uses it |
|-------------|-------------------|-------------|
| **Admin console** | http://localhost:3000 | Catalog editors, approvers, operations |
| **Storefront** | http://localhost:3002 | Shoppers (public, no login) |
| **API** | http://localhost:3001 | Used by Admin and Storefront (not browsed directly) |
| **Developer portal** | http://localhost:3003 | API integrators |

All catalog data belongs to an **organization** (tenant). The default organization slug is **`demo`**.

When deploying to production (e.g. Railway), use your assigned Admin and Storefront domains instead of localhost.

### Production (Railway)

| Surface | URL |
|---------|-----|
| **API** | https://pim-api.up.railway.app |
| **API health** | https://pim-api.up.railway.app/health/ready |
| **Admin** | https://pim-admin.up.railway.app/login |
| **Storefront** | https://pim-store.up.railway.app |

Setup details: [deployment/railway-production.md](./deployment/railway-production.md)

---

## 2. Signing in

### Admin console

1. Open the Admin URL (e.g. http://localhost:3000/login).
2. Enter:
   - **Organization** — usually `demo`
   - **Email** — your account email
   - **Password** — your account password
3. Click **Sign in**.

After a successful login you are taken to the **Dashboard**. Sessions use secure cookies; sign out from the header menu when finished.

### Default demo credentials

After running `pnpm db:seed`, a default administrator exists:

| Field | Value |
|-------|-------|
| Organization | `demo` |
| Email | `admin@demo.local` |
| Password | `Admin123!@#demo` (or value of `ADMIN_PASSWORD` in `.env`) |

Change these credentials in production.

### Storefront

The storefront does **not** require login. It shows products that are approved and indexed for search.

---

## 3. Roles and permissions

Each user has one or more roles. The sidebar and action buttons adapt to your permissions.

| Role | Description |
|------|-------------|
| **Administrator** | Full access: users, security, taxonomy, MDM, and all catalog operations |
| **Product Editor** | Create and edit products; submit for review |
| **Product Approver** | Approve, reject, and publish products |
| **Operations** | Imports, publishing, search reindex, event tooling |
| **Read Only** | View catalog, workflow, audit, and reports; no edits |

### What each role can do

| Task | Admin | Editor | Approver | Ops | Read only |
|------|:-----:|:------:|:--------:|:---:|:---------:|
| View dashboard, products, reports | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit product fields | ✓ | ✓ | | | |
| Submit for review | ✓ | ✓ | | | |
| Approve / reject / publish | ✓ | | ✓ | | |
| Manage taxonomy | ✓ | | | | |
| Run import jobs | ✓ | | | ✓ | |
| Run publish jobs | ✓ | | | ✓ | |
| Resolve MDM source records | ✓ | | | | |
| Manage users & view security | ✓ | | | | |

If you try to open a page your role cannot access, you are redirected to the Dashboard.

---

## 4. Product lifecycle

Products move through workflow states before they appear on the storefront or in channel exports.

```
DRAFT ──submit──► IN_REVIEW ──approve──► APPROVED ──publish──► PUBLISHED
                     │
                     └──reject──► REJECTED ──submit──► IN_REVIEW
```

| Status | Meaning |
|--------|---------|
| **DRAFT** | Work in progress; not visible to shoppers |
| **IN_REVIEW** | Submitted; waiting for an approver |
| **APPROVED** | Content approved; eligible for search and export |
| **PUBLISH_READY** | Ready for external syndication (optional gate) |
| **PUBLISHED** | Live in the catalog |
| **REJECTED** | Sent back to the editor; fix and resubmit |
| **ARCHIVED** | Retired from the active catalog |

### Visibility rules

| Status | On storefront / search? | In publish exports? |
|--------|:-----------------------:|:-------------------:|
| APPROVED, PUBLISH_READY, PUBLISHED | Yes | Yes |
| DRAFT, IN_REVIEW, REJECTED, ARCHIVED | No | No |

New products from imports start as **DRAFT** and must go through workflow before shoppers see them.

---

## 5. Admin console overview

### Navigation

| Menu item | Path | Purpose |
|-----------|------|---------|
| **Dashboard** | `/admin/dashboard` | Catalog health, workflow backlog, import/publish stats |
| **Products** | `/admin/products` | Product list and detail |
| **Taxonomy** | `/admin/taxonomy/*` | Categories, attributes, facets (admin only) |
| **Imports** | `/admin/imports` | CSV import jobs |
| **Workflow** | `/admin/workflow` | Approval task inbox |
| **Publishing** | `/admin/publishing` | Channel exports |
| **MDM** | `/admin/mdm/*` | Source records and survivorship rules |
| **Audit** | `/admin/audit` | Change history |
| **Reports** | `/admin/reports` | Completeness and throughput metrics |
| **Users** | `/admin/users` | User accounts (admin only) |
| **Security** | `/admin/security` | Password policy and security events (admin only) |

### Common UI patterns

- **Tables** — click a row to open detail.
- **Status chips** — color-coded workflow and job states.
- **Loading / error / empty states** — shown when data is fetching, failed, or absent.
- **Toasts** — brief confirmation after save or workflow actions.

---

## 6. Managing products

### Product list

**Products** shows a paginated table with filters for **status** and **title search**.

Columns include SKU, title, type (Simple / Parent / Variant), status, and brand. Click a row to open the product detail page.

### Product detail

On the detail page you can:

- **Edit** title and brand (if you have edit permission).
- **View attributes** assigned to the product.
- **Open variants** — for parent products, links to each variant SKU.
- **Run workflow actions** — Submit, Approve, Reject, or Publish (role-dependent).
- **View workflow history** — timeline of state changes.

### Product types

| Type | Description |
|------|-------------|
| **Simple** | Standalone SKU |
| **Parent** | Grouping product with variants (e.g. a shirt style) |
| **Variant** | Child SKU with axis attributes (e.g. color, size) |

Variants inherit attributes from the parent unless overridden.

---

## 7. Taxonomy (categories, attributes, facets)

Taxonomy defines how products are organized and filtered. **Administrators** manage taxonomy; other roles typically have read-only access.

### Categories

**Taxonomy → Categories** shows the category tree (name, code, path, status). Categories are used for navigation, import mapping (`category_code` in CSV), and facet scoping.

### Attributes

**Taxonomy → Attributes** lists attribute groups and definitions (key, label, data type, filterable flag, variant axis).

Attributes hold structured product data (brand, color, price, specifications).

### Facets

**Taxonomy → Facets** shows facet definitions and transformation rules. Facets power sidebar filters on the storefront (e.g. brand, price range, tool type).

---

## 8. Bulk imports

Imports load many products from a CSV file. **Operations** and **Administrators** run imports; all roles can monitor job status.

### Typical workflow

1. **Upload** a CSV file (via API or integration; the Admin UI monitors jobs after upload).
2. **Validate** — the system checks required fields, duplicate SKUs, category codes, attributes, and parent references.
3. **Review errors** — invalid rows appear in the error table; download an error report CSV if needed.
4. **Start processing** — valid rows are written to the catalog (as DRAFT products).
5. **Monitor** — track row counts and job status on the import list and detail pages.

### Import job statuses

| Status | Meaning |
|--------|---------|
| UPLOADED | File received |
| VALIDATING / VALIDATED | Validation in progress or passed |
| VALIDATION_FAILED | Fix the file and upload again |
| PROCESSING | Rows being written |
| COMPLETED | Finished (some rows may still have failed) |
| FAILED | Job-level failure |

### Default CSV columns (demo template)

The seeded template `mvp-product-csv` expects columns such as:

`sku`, `product_type`, `title`, `description`, `brand`, `parent_sku`, `category_code`, `color`, `size`

See **Imports → job detail** for validation errors with row numbers and field names.

---

## 9. Workflow and approvals

Workflow ensures product content is reviewed before it goes live.

### Task inbox

**Workflow** lists approval tasks filtered by status (Open, Completed, Cancelled). Each task links to a product and shows assigned role, SKU, and current product status.

Open a task to see metadata, prior approvals, and history. **Approvers** can **Approve** or **Reject** open tasks from the task detail page or from the product detail page.

### Rejection

Rejecting a product requires a **reason**. The product returns to **REJECTED**; editors fix issues and **Submit** again.

### Product-level actions

On **Products → detail**, use the workflow buttons:

| Action | Who | From status | To status |
|--------|-----|-------------|-----------|
| Submit | Editor | DRAFT, REJECTED | IN_REVIEW |
| Approve | Approver | IN_REVIEW | APPROVED |
| Reject | Approver | IN_REVIEW | REJECTED |
| Publish | Approver | APPROVED | PUBLISHED |

---

## 10. Publishing to channels

Publishing exports approved catalog data to **sales channels** as files (CSV/JSON). **Operations** and **Administrators** run publish jobs.

### Concepts

| Term | Meaning |
|------|---------|
| **Channel** | A destination with field mappings (e.g. Shopify CSV) |
| **Dry run** | Generate an export without treating it as production |
| **Live run** | Production export job |
| **Publish job** | A batch run with per-product items and downloadable artifacts |

### Typical workflow

1. Open **Publishing** and select a channel (e.g. seeded `demo-store`).
2. Run **Dry run** to preview the export, or **Live run** for production.
3. Open the job detail page to monitor progress.
4. **Download** the export artifact when complete.
5. **Retry** failed jobs if some products did not export.

Only products in **APPROVED**, **PUBLISH_READY**, or **PUBLISHED** are included. Draft and in-review products are skipped.

### Job detail page

Shows total/success/failed item counts, channel field mappings, per-product export status, and error messages for failed items.

---

## 11. Search and the storefront

### How search works

Search uses a **projection** (search index) built from approved products. The PostgreSQL database remains the source of truth; the index powers fast faceted browse and query.

After large catalog changes, operations may trigger a **reindex** (automatic via events in normal operation, or manually via API).

### Storefront (shopper experience)

| Page | What shoppers do |
|------|------------------|
| **Home** | Browse featured products and top categories |
| **Category** (`/category/{code}`) | Browse products in a category with sidebar facets |
| **Search** (`/search?q=…`) | Full-text search with filters |
| **Product** (`/product/{id}`) | View details, pick variants, add to cart |
| **Cart** | Review line items and quantities |
| **Checkout** | Place order (Stripe if configured, otherwise mock checkout) |

### Faceted filters

On category and search pages, the sidebar shows facets (brand, price range, category-specific attributes) with result counts. Filters update the URL so results are shareable.

### Demo catalog

The default demo catalog includes **500** `DEMO-*` simple products plus the `SHIRT-001` parent and variants. To refresh after deploy:

```bash
pnpm reseed:demo
```

Add or refresh demo products only (without full purge):

```bash
pnpm seed:demo-products --count=500
```

This removes any Fleet Farm (`FF-*`) products when using `reseed:demo`.

---

## 12. Master data (MDM)

MDM handles product data arriving from external systems (ERP, PLM) and resolves it to golden records in the catalog.

### Source records

**MDM → Source records** is the steward queue. Each record shows inbound payload, match status, and candidates.

For unmatched or ambiguous records, administrators can:

- **Link** to an existing product
- **Create** a new product from the source data
- **Ignore** the record

### Survivorship rules

**MDM → Survivorship rules** lists attribute precedence when multiple systems supply values (e.g. PLM wins over ERP for description).

### Product MDM view

**MDM → product detail** (from a linked product) shows golden-record summary, linked system IDs, and recent MDM audit entries.

---

## 13. Audit and reports

### Audit log

**Audit** provides a filterable history of changes:

- Filter by entity type, entity ID, or action (create, update, delete, state change, import, export).
- Click a row to open a detail panel with before/after snapshots and changed fields.

Use audit for compliance questions (“who changed this SKU?”) and troubleshooting.

### Reports

**Reports** aggregates operational metrics:

- **Catalog completeness** — scores by category
- **Workflow throughput** — tasks opened and completed
- **Import success rates** — jobs and row outcomes
- **Publish success rates** — jobs and item outcomes

### Dashboard

The **Dashboard** summarizes totals at a glance: product counts by status, catalog completeness percentage, open workflow tasks, import/publish job counts, and eventing health (outbox status, dead letters).

---

## 14. Users and security (administrators)

### User management

**Users** (admin only):

- **Create** accounts with email, name, and role checkboxes.
- **View** all users and their roles.
- **Unlock** accounts locked after failed login attempts.

New users receive a password from the administrator (or via your organization’s onboarding process).

### Security settings

**Security** (admin only) shows:

- **Password policy** — minimum length, complexity rules, lockout thresholds
- **Session policy** — access token lifetime, refresh token lifetime
- **Security audit events** — recent login failures, lockouts, and related events

Password requirements are enforced on login and user creation.

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Organization** | Tenant; all data is isolated per org slug (e.g. `demo`) |
| **SKU** | Stock keeping unit; unique product identifier within an org |
| **Workflow state** | Approval status of a product (Draft, In Review, etc.) |
| **Facet** | Filterable attribute in search (e.g. Brand, Price range) |
| **Search projection** | Search-optimized copy of catalog data |
| **Channel** | Export destination with field mappings |
| **Publish job** | Batch export with downloadable artifact |
| **Import job** | Batch CSV load with validation and error reporting |
| **Source record** | Inbound product data from an external system (MDM) |
| **Golden record** | Authoritative product after MDM merge |

---

## 16. Troubleshooting

| Problem | What to try |
|---------|-------------|
| **Cannot sign in** | Verify organization slug, email, and password. Ask an admin to unlock your account on **Users**. |
| **Unauthorized after login** | Ensure Admin and API share the same `JWT_SECRET` (deployment issue). Clear browser cookies and sign in again. |
| **Product not on storefront** | Check status is APPROVED or PUBLISHED. Wait for search index update or ask ops to reindex. |
| **Import validation errors** | Open job detail → review error table → fix CSV → upload again. |
| **Publish job skipped products** | Product may be DRAFT or missing required channel fields. Check item errors on job detail. |
| **Empty dashboard metrics** | Run `pnpm reseed:demo` or `pnpm db:seed` in your environment. |
| **Facets missing on storefront** | Run `pnpm reseed:demo` to publish and reindex the base catalog. |

For deployment issues, see [deployment/railway.md](./deployment/railway.md) or [deployment/railway-production.md](./deployment/railway-production.md) for the live `productinfoman-production` environment.

For API integration details, see the [Developer portal](http://localhost:3003) or `apps/devportal`.

---

## Related documentation

| Document | Audience |
|----------|----------|
| [README](../README.md) | Developers — quick start |
| [deployment/railway.md](./deployment/railway.md) | Operators — production deploy |
| [performance/slos.md](./performance/slos.md) | Platform — performance targets |
| [implementation/](./implementation/) | Developers — feature specifications |

---

*ProductInfoMan — Ecommerce Product Information Management*
