# Product MDM Layer Spec Alignment

Product MDM elevates the PIM MVP into a **product-domain master data hub** — the golden
source of product records synchronized across ERP, PLM, ecommerce, and other systems.

## Scope

- Product master only (not customer/supplier MDM)
- Deterministic key-based matching (no fuzzy AI in MVP)
- ERP as primary upstream example (`sourceSystem: "ERP"`)

## Schema

| Table | Purpose |
|-------|---------|
| `ProductSystemId` | External IDs per system (ERP, PLM, ECOM, etc.) |
| `ProductSourceRecord` | Raw/normalized inbound records |
| `ProductMatchCandidate` | Ambiguous match suggestions |
| `SurvivorshipRule` | Attribute-level golden-record rules |

`ImportJob.sourceSystem` tags imports for MDM processing.

## Services

| Component | Location |
|-----------|----------|
| Matching engine | `packages/mdm-engine` |
| MDM orchestration | `apps/api/src/modules/mdm/mdm.service.ts` |
| Admin APIs | `apps/api/src/modules/mdm/mdm.routes.ts` |

### Matching (deterministic)

1. Exact external ID via `product_system_ids`
2. Exact GTIN/UPC attribute
3. Brand + MPN combination
4. Exact SKU

Outcomes: `matched` (1 hit), `unmatched` (0 hits), ambiguous (2+ hits → steward queue)

### Survivorship

| Rule type | Behavior |
|-----------|----------|
| `SOURCE_PRIORITY` | First non-empty value from configured source order |
| `MOST_RECENT` | Latest `updated_at` wins |
| `MOST_COMPLETE` | Longest/non-null value wins |

## APIs

| Method | Path |
|--------|------|
| GET | `/api/v1/mdm/products/:id/systems` |
| POST | `/api/v1/mdm/products/:id/systems` |
| GET | `/api/v1/mdm/source-records` |
| GET | `/api/v1/mdm/source-records/:id` |
| POST | `/api/v1/mdm/source-records/:id/match` |
| GET | `/api/v1/mdm/survivorship-rules` |
| POST | `/api/v1/mdm/survivorship-rules` |
| POST | `/api/v1/mdm/products/inbound` |

## Events

- `product.mdm.matched`
- `product.mdm.merged`
- `product.mdm.attribute_overridden`

Routed to `search-sync`, `publish-sync`, and `audit-sync` consumers.

## Import integration

When `ImportJob.sourceSystem` is set:

1. Each valid row → `product_source_records`
2. Deterministic matching runs
3. Matched → survivorship updates master
4. Unmatched → steward queue (or create if `importType` CREATE/UPSERT)

## Admin UI

| Route | Purpose |
|-------|---------|
| `/admin/mdm/source-records` | Steward queue |
| `/admin/mdm/source-records/:id` | Resolve link/create/ignore |
| `/admin/mdm/survivorship-rules` | Rule table |
| `/admin/mdm/products/:id` | Master + system IDs + audit |

## ASSUMPTION CHANGEs

- **IDs:** `cuid()` instead of UUID (matches existing Prisma conventions)
- **Fuzzy matching:** deferred; deterministic keys only
- **Multi-domain MDM:** out of scope

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Multiple system IDs per product | ✅ |
| ERP inbound → match → survivorship | ✅ |
| Unmatched records in steward queue | ✅ |
| Search/publish react to MDM events | ✅ |
| Admin stewardship UI | ✅ |
