# Performance baselines

Store formal load-test results here after each benchmark run.

## File naming

`YYYY-MM-DD-<scenario>-<environment>.json`

Example: `2026-06-23-search-staging.json`

## JSON template

```json
{
  "date": "2026-06-23",
  "environment": "staging",
  "scenario": "storefront-search",
  "tool": "k6",
  "config": {
    "baseUrl": "https://api.staging.example.com",
    "vus": 50,
    "duration": "3m"
  },
  "latency_ms": {
    "p50": 0,
    "p95": 0,
    "p99": 0
  },
  "error_rate": 0,
  "notes": "Post perf-hardening baseline; category tree cached 300s"
}
```

## Initial baseline (local smoke, 2026-06-23)

Local smoke validation was performed via unit tests for resilience primitives (circuit breaker, backpressure) and API health endpoints. Full k6 runs require a seeded staging environment with tens of thousands of products — run the scripts in `tools/load-tests/k6/` and commit results here.

### SLO reference

| Surface | P95 target |
|---------|------------|
| Search | < 300 ms |
| Category tree | < 200 ms |
| Admin product read | < 400 ms |
| Admin product write | < 500 ms |

See [slos.md](../slos.md) for full targets and analysis checklist.
