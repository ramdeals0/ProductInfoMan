# Phase 3 — Import and Validation Spec Alignment

Phase 3 is **implemented** on top of Phase 1 Product Core and Phase 2 Taxonomy.
Workflow approvals, search indexing, publishing, and AI enrichment are later phases.

## Stack

Fastify · Prisma · Zod · `packages/import-engine` · BullMQ (Redis) with sync fallback

## Schema mapping (ASSUMPTION CHANGEs)

| Brief table / field | Implementation | Notes |
|---------------------|----------------|-------|
| `external_id` | `sku` | **ASSUMPTION CHANGE:** business key from Phase 1 |
| `import_type` `product\|variant\|combined` | `ImportType` `CREATE\|UPDATE\|UPSERT` + row `product_type` | **ASSUMPTION CHANGE:** mode + per-row type |
| `mode` `add_only\|update_only\|add_or_update` | `importType` + `duplicatePolicy` | `CREATE`/`UPDATE`/`UPSERT` + `REJECT`/`UPDATE`/`SKIP` |
| `status` enum | `ImportJobStatus` | `UPLOADED`, `VALIDATING`, `VALIDATED`, `VALIDATION_FAILED`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `import_template_mappings` | `ImportTemplateMapping` | `sourceColumn`, `targetField`, `isRequired`, `transform` (optional) |
| `config_json` | `ImportTemplate.configJson` | Template-level options |
| `raw_json` | `ImportJobRow.rawData` (JSON) | Parsed CSV row |
| `validation_rules` | `ValidationRule` | Seeded; `REQUIRED_FIELD` wired; other types extensible |
| — | `ImportRunSummary` | **ASSUMPTION CHANGE:** commit summary table |

File storage: local `uploads/{orgId}/{jobId}/` (**ASSUMPTION CHANGE:** not S3/MinIO in MVP).

## Domain types (`packages/domain`)

| Brief type | Export |
|------------|--------|
| ImportJob | `ImportJobEntity` |
| ImportTemplate | `ImportTemplateEntity` |
| ImportTemplateMapping | `ImportTemplateMappingEntity` |
| ImportJobRow | Stored in DB; normalized shape in `import-engine` |
| ImportJobError | `ImportJobErrorEntity` |
| ValidationRule | Prisma model; not yet exported as domain entity |
| Run summary | `ImportRunSummaryEntity` |

## Validation (`packages/validation`)

| Brief schema | Zod export |
|--------------|------------|
| CreateImportJobRequest | `UploadImportSchema` (multipart fields) |
| CreateImportTemplateRequest | `CreateImportTemplateSchema` |
| List imports | `ListImportsQuerySchema` |

## Import engine (`packages/import-engine`)

| Brief module | Export |
|--------------|--------|
| CsvParser | `parseCsv()` |
| RowNormalizer | `normalizeRow()` |
| Validator | `validateImportRows()` |
| Error report | `buildErrorReportCsv()` |

### Validation rules implemented

| Rule | Error code | Status |
|------|------------|--------|
| Required fields | `REQUIRED_FIELD` | Done |
| Duplicate SKU in file | `DUPLICATE_KEY` | Done |
| Duplicate SKU in DB | `DUPLICATE_KEY` | Done |
| Unknown category code | `INVALID_CATEGORY` | Done |
| Unknown attribute key | `UNKNOWN_ATTRIBUTE` | Done |
| Invalid parent SKU | `INVALID_PARENT_REFERENCE` | Done |
| Blank cells | `blankCellPolicy` `IGNORE` / `CLEAR` | Partial on normalize |

## API endpoints

Base: `/api/v1` · Header: `X-Organization-Slug: demo`

| Brief | Implemented |
|-------|-------------|
| POST /imports/upload | `POST /imports/upload` (multipart) |
| POST /imports/:id/validate | Done |
| POST /imports/:id/start | Done (BullMQ or sync) |
| GET /imports | Done (paginated) |
| GET /imports/:id | Done |
| GET /imports/:id/errors | Done |
| GET /imports/:id/report | Done (CSV download) |
| POST /import-templates | Done |
| GET /import-templates | Done |

## Async processing

| Brief queue | Implementation |
|-------------|----------------|
| `import:validate` | **ASSUMPTION CHANGE:** validation runs synchronously on `POST validate` |
| `import:process` | BullMQ queue `import-jobs`, job `process-import` |
| Sync fallback | `IMPORT_SYNC=true` or missing `REDIS_URL` |

Worker co-located in API process (`import.queue.ts`).

## Commit behavior

Valid rows call Product Core `createProduct` + `setProductAttributes`.
Parents are processed before variants. Partial success: invalid rows skipped, valid rows committed.

**Known gap:** `UPDATE`/`UPSERT` import types validated but commit path is create-focused.

## Tests

```bash
pnpm --filter @productinfoman/import-engine test
pnpm --filter @productinfoman/api test -- src/__tests__/import-validation.test.ts
```

## Deliverables checklist

- [x] CSV upload + import job persistence
- [x] Validation before DB writes
- [x] Invalid rows logged with error records
- [x] Valid rows committed asynchronously
- [x] Job summaries and error retrieval
- [x] Tests for required, duplicate, category, attribute, parent validations

## Out of scope (later phases)

Workflow approvals (initial `DRAFT` status only), search indexing, publishing, AI enrichment.
