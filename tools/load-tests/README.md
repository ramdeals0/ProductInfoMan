# Load testing (k6)

Repeatable load tests for the PIM API. Targets and scenarios are defined in [docs/performance/slos.md](../../docs/performance/slos.md).

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed locally or in CI
- API running against staging (or local with seeded data)
- Demo org seeded (`pnpm db:seed` and optionally `pnpm seed:demo-catalog`)

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3001` | API base URL |
| `ORG_SLUG` | `demo` | Tenant header value |
| `ADMIN_EMAIL` | `admin@demo.local` | Admin login for authenticated scenarios |
| `ADMIN_PASSWORD` | `Admin123!@#demo` | Admin password |
| `IMPORT_ROWS` | `500` | Rows generated for import test |
| `CHANNEL_ID` | _(first channel)_ | Channel for publish test |
| `PUBLISH_MODE` | `DRY_RUN` | `DRY_RUN` or `LIVE` |

## Scripts

```bash
# Storefront search (anonymous GET)
k6 run tools/load-tests/k6/search.js

# Admin product CRUD
k6 run tools/load-tests/k6/products.js

# Bulk import upload + start
k6 run -e IMPORT_ROWS=1000 tools/load-tests/k6/imports.js

# Publishing dry-run / export
k6 run tools/load-tests/k6/publish.js
```

Against staging:

```bash
k6 run -e BASE_URL=https://api.staging.example.com \
  -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... \
  tools/load-tests/k6/search.js
```

## Metrics collection

During runs, scrape Prometheus from the API (`GET /metrics`) and correlate with k6 summary output.

Record baselines under `docs/performance/baselines/` after formal runs.

## CI smoke load (optional)

A lightweight check can run search.js with 5 VUs for 30s in staging pipelines — see `docs/performance/baselines/README.md`.
