# Performance SLOs & Test Scenarios

## Service level objectives

| Surface | Metric | Target (P95) | Notes |
|---------|--------|--------------|-------|
| Storefront search | `GET /api/v1/search` | < 300 ms | Faceted queries, page size ≤ 50 |
| Category listing | `GET /api/v1/categories/tree` | < 200 ms | Cached 5–15 min |
| Admin product read | `GET /api/v1/products/:id` | < 400 ms | Moderate concurrent editors |
| Admin product write | `PATCH /api/v1/products/:id` | < 500 ms | Includes audit write |
| Import job | 50k–100k rows | Predictable completion | No API starvation; worker concurrency = 1 |
| Publish export | 10k products | Completes without timeout | Batched writes; concurrency limited |

## Load test scenarios

1. **Search traffic** — concurrent storefront queries with facets and pagination (`tools/load-tests/k6/search.js`).
2. **Admin CRUD** — mixed read/write on products while imports run (`tools/load-tests/k6/products.js`).
3. **Bulk import** — upload + start import job; monitor worker queue depth (`tools/load-tests/k6/imports.js`).
4. **Publishing** — dry-run / live publish for large product sets (`tools/load-tests/k6/publish.js`).
5. **Mixed workload** — search + admin edits + background import (run scenarios in parallel against staging).

## Analysis checklist

- P50 / P95 / P99 latency from k6 or Prometheus histograms
- Error rate (5xx, 429 backpressure)
- CPU / memory on API and workers
- Postgres connections (`DATABASE_POOL_MAX`)
- Redis memory and queue depths (`pim_queue_depth`)
- OpenSearch cluster health (if enabled)

## Baseline artifacts

Store results under `docs/performance/baselines/` after each formal load test run (JSON summary + notes).
