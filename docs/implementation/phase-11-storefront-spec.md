# Phase 11 — Headless Storefront Spec Alignment

Phase 11 is **implemented** as `apps/storefront` — a Next.js 15 customer-facing storefront
that reads catalog data exclusively from the PIM HTTP APIs via read-only `CatalogClient`.

## Stack

Next.js App Router · React 19 · TypeScript · Tailwind CSS · TanStack Query · Zustand · Stripe Checkout (optional)

## Architecture (ASSUMPTION CHANGEs)

| Brief | Implementation | Notes |
|-------|----------------|-------|
| `packages/ui` shared components | `apps/storefront/src/components/` | **ASSUMPTION CHANGE:** storefront UI is app-local, same pattern as admin |
| Product price from PIM | Mock price from SKU/attributes | **ASSUMPTION CHANGE:** no price field in search projection or product core |
| Product images from digital assets | `placehold.co` placeholders | **ASSUMPTION CHANGE:** no asset CDN wired in MVP |
| Separate orders app | `apps/storefront/src/app/api/checkout` | Minimal checkout route in storefront |
| Slug-based product URLs | ID-based (`/product/:id`) | Slug resolution optional for MVP |

## Page map

| Brief route | Implemented | Notes |
|-------------|-------------|-------|
| `/` | ✅ | Hero, featured categories, featured products |
| `/category/[slug]` | ✅ | PLP with facets + pagination |
| `/search` | ✅ | Full-text search with facets |
| `/product/[id-or-slug]` | ✅ | PDP with variants, attributes, add-to-cart (`/product/:id`) |
| `/cart` | ✅ | Zustand cart with quantity controls |
| `/checkout` | ✅ | Stripe session or mock checkout |
| `/checkout/success` | ✅ | Thank-you page, clears cart |

## Catalog client (`packages/api-client/src/catalog.ts`)

Read-only `CatalogClient` — no admin mutation APIs exposed.

| Method | API |
|--------|-----|
| `searchProducts` | `GET /api/v1/search` |
| `searchCategoryProducts` | `GET /api/v1/search/categories/:id` |
| `getSearchFacets` | `GET /api/v1/search/facets` |
| `getProduct` | `GET /api/v1/products/:id` |
| `listVariants` | `GET /api/v1/products/:parentId/variants` |
| `getCategoryTree` | `GET /api/v1/categories/tree` |
| `listCategories` | `GET /api/v1/categories` |
| `getCategoryByCode` | `listCategories` + client filter |

## Facet URL model

Category and search pages sync filter state to query params:

```
/category/shoes?facet[color]=Red&facet[size]=10&page=2
/search?q=drill&facet[brand]=Acme
```

Parsed by `parseFacetFilters` and sent to the API as `filters[key]=value`.

## Cart & checkout

- **Cart:** Zustand store with `localStorage` persistence (`pim-storefront-cart`)
- **Checkout:** `POST /api/checkout` with cart items
  - When `STRIPE_SECRET_KEY` is set → Stripe Checkout Session redirect
  - Otherwise → mock order, redirect to `/checkout/success?mode=mock`

## Environment

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | PIM API base (empty = same-origin rewrites) |
| `NEXT_PUBLIC_ORG_SLUG` | Tenant header (default `demo`) |
| `API_URL` | Server-side rewrite target (default `http://localhost:3001`) |
| `STRIPE_SECRET_KEY` | Optional Stripe Checkout |
| `NEXT_PUBLIC_SITE_URL` | Checkout success/cancel URLs |

## Dev commands

```bash
pnpm install
pnpm --filter @productinfoman/api dev          # :3001
pnpm --filter @productinfoman/storefront dev   # :3002
```

## Tests

- `apps/storefront` — cart store, catalog helpers, facet param parsing
- `packages/api-client` — catalog query builder

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Browse categories and products | ✅ |
| Faceted filter on category/search | ✅ |
| Product detail with attributes/variants | ✅ |
| Add to cart + cart summary | ✅ |
| Checkout (Stripe or mock) | ✅ |
| Only published products via search | ✅ (backend projection) |
| No product mutations from storefront | ✅ |
| Responsive layout | ✅ |
