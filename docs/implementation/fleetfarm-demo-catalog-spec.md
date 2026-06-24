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
| `tools-hardware` | Tools & Hardware | 20 |
| `outdoor-power` | Outdoor Power Equipment | 20 |
| `clothing-workwear` | Clothing & Workwear | 20 |
| `fishing-hunting` | Fishing & Hunting | 20 |

## Amazon-style facets

**Global:** brand, price_range, rating, availability

**Category-specific:**
- Tools: tool_type, power_source
- Outdoor power: engine_displacement, bar_length, fuel_type
- Clothing: size, gender, color
- Fishing: gear_type, species

## Commands

```bash
pnpm db:push
pnpm db:seed              # base demo org + apparel sample
pnpm seed:demo-catalog      # Fleet Farm fixtures + facets + reindex
pnpm seed:demo-catalog:live # attempt live scrape (falls back to fixtures)
```

Options:
- `--org=demo` — target organization slug
- `--no-reindex` — skip search projection reindex
- `--live` — polite HTTP scrape with rate limiting

## Files

| File | Purpose |
|------|---------|
| `tools/fleetfarm/config.ts` | Category URLs and robots policy |
| `tools/fleetfarm/fixtures.ts` | Curated product catalog |
| `tools/fleetfarm/scraper.ts` | Live scrape + fixture fallback |
| `tools/fleetfarm/parsers.ts` | HTML/JSON-LD parsers |
| `tools/fleetfarm/facets.ts` | Attribute + facet definitions |
| `tools/seed-demo-catalog.ts` | Orchestrator |
| `tools/lib/seed-catalog.ts` | DB upsert helpers |

## Verification

After seeding, with API running:

```bash
curl -H "X-Organization-Slug: demo" "http://localhost:3001/api/v1/search?pageSize=5"
curl -H "X-Organization-Slug: demo" "http://localhost:3001/api/v1/search/facets"
```

Storefront (`:3002`) should show categories under `/category/tools-hardware` etc. with brand and price facets.
