# Fleet Farm Demo Catalog Seeding

Demo/internal catalog seed inspired by [FleetFarm.com](https://www.fleetfarm.com) assortment with Amazon-style faceted search.

## ASSUMPTION CHANGEs

- **Default data source:** curated fixtures (`tools/fleetfarm/fixtures.ts`) — 80 products across 4 categories. Live scraping is opt-in via `--live`.
- **robots.txt:** `/browse/` and `/search/` are disallowed; scraper rejects blocked paths and falls back to fixtures per category.
- **Rate limit:** 2 seconds between HTTP requests when `--live` is used.
- **IDs:** products use SKU prefix `FF-{externalId}` and MDM system code `FLEETFARM`.

## Categories (4 top-level under `fleetfarm-demo`)

| Code | Name | Products |
|------|------|----------|
| `tools` | Tools & Hardware | 20 |
| `outdoor_power` | Outdoor Power Equipment | 20 |
| `clothing` | Clothing & Workwear | 20 |
| `fishing` | Fishing & Hunting | 20 |

## Amazon-style facets

Shared configuration lives in `packages/config/facets.config.ts`.

**Global:** brand, price (range buckets), rating, availability

**Category-specific:**
- Tools: tool_type, power_source, voltage
- Outdoor power: equipment_type, bar_length_in, fuel_type
- Clothing: apparel_gender, apparel_size, color, apparel_type
- Fishing: category_subtype

### Search projection (price bucketing)

Numeric `price` attribute values are converted into configured range buckets when building search `facet_fields`:

- Under $25
- $25 to $50
- $50 to $100
- $100 to $200
- $200 & Above

Other facets use attribute values directly (brand, tool_type, etc.).

## Commands

```bash
pnpm db:push
pnpm db:seed                  # base demo org + apparel sample
pnpm seed:attributes-facets   # attributes, groups, facet definitions + rules only
pnpm seed:demo-catalog        # Fleet Farm fixtures + facets + reindex
pnpm seed:demo-catalog:live   # attempt live scrape (falls back to fixtures)
```

Options:
- `--org=demo` — target organization slug
- `--no-reindex` — skip search projection reindex
- `--live` — polite HTTP scrape with rate limiting

## Files

| File | Purpose |
|------|---------|
| `packages/config/facets.config.ts` | Attribute + facet seed configuration |
| `tools/seed-attributes-and-facets.ts` | Standalone attributes/facets seed CLI |
| `tools/lib/seed-attributes-facets.ts` | Idempotent Prisma upsert logic |
| `tools/fleetfarm/config.ts` | Category URLs and robots policy |
| `tools/fleetfarm/fixtures.ts` | Curated product catalog |
| `tools/fleetfarm/scraper.ts` | Live scrape + fixture fallback |
| `tools/fleetfarm/parsers.ts` | HTML/JSON-LD parsers |
| `tools/fleetfarm/facets.ts` | Re-exports shared facet config helpers |
| `tools/seed-demo-catalog.ts` | Full catalog orchestrator |
| `tools/lib/seed-catalog.ts` | Product upsert helpers |

## Verification

After seeding, with API running:

```bash
curl -H "X-Organization-Slug: demo" "http://localhost:3001/api/v1/search?pageSize=5"
curl -H "X-Organization-Slug: demo" "http://localhost:3001/api/v1/search/facets"
```

Storefront (`:3002`) should show categories under `/category/tools` etc. with brand and price facets.
