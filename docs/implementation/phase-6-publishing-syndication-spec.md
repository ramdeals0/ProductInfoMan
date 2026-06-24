# Phase 6 — Publishing and Syndication Spec Alignment

Phase 6 is **implemented** on top of Phases 1–5. Storefront UI and multi-channel
API push are out of scope for this MVP.

## Stack

Fastify · Prisma · `packages/publish-engine` · BullMQ with sync fallback · Local/S3 storage · Zod

## Schema mapping (ASSUMPTION CHANGEs)

| Brief table / field | Implementation | Notes |
|---------------------|----------------|-------|
| `channels.export_format` | `Channel.destinationType` | `CSV`, `JSON`, `HTTP_WEBHOOK`, `SFTP` |
| `channel_field_mappings` | `ChannelFieldMapping` | Versioned via `ChannelMappingVersion` |
| `transform_type` `copy` | `ChannelTransformType.DIRECT` | **ASSUMPTION CHANGE:** also supports TEMPLATE, CONCAT, LOOKUP, DEFAULT |
| `publish_jobs.mode` `dry_run\|real` | `PublishJobMode` `DRY_RUN\|LIVE` | |
| `publish_jobs.status` | `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `RETRYING` | |
| `filter_config_json` | `PublishJob.filterConfig` (JSON) | `productIds`, `categoryIds`, etc. |
| `file_path` | `ExportArtifact.storagePath` | Local `exports/` or S3-compatible |
| — | `ChannelValidationRule` | Publish-readiness (allowed statuses, required fields) |
| — | `PublishHistory` | Audit trail for runs and retries |

Transform engine: `packages/publish-engine` — maps source paths to target fields.

Projection: `publish.projection.ts` builds canonical export records from Product Core + taxonomy.

## Domain types (`packages/domain`)

| Brief type | Export |
|------------|--------|
| Channel | `ChannelEntity` |
| ChannelFieldMapping | `ChannelFieldMappingEntity` |
| PublishJob | `PublishJobEntity` |
| PublishJobItem | `PublishJobItemEntity` |
| ExportArtifact | `ExportArtifactEntity` |
| Channel preview | `ChannelPreviewEntity` |

## Validation (`packages/validation`)

| Brief schema | Zod export |
|--------------|------------|
| CreateChannelInput | `CreateChannelSchema` |
| CreateChannelMappingInput | `CreateChannelFieldMappingSchema` |
| CreatePublishJobInput | `PublishRunSchema` |
| List jobs | `ListPublishJobsQuerySchema` |

## Publishing service (`publish.service.ts`)

| Brief method | Implementation |
|--------------|----------------|
| `createChannel` | `createChannel()` |
| `listChannels` | `listChannels()` |
| `createOrUpdateFieldMappings` | `createChannelMappings()` / `getChannelMappings()` |
| `createPublishJob` | `startDryRun()` / `startPublishRun()` |
| `processPublishJob` | `executePublishJob()` (via queue) |
| `retryPublishJob` | `retryPublishJob()` |
| Channel preview | `previewChannel()` |

## Async jobs

| Brief queue | Implementation |
|-------------|----------------|
| `publish:run` | `publish-jobs` queue; sync when `PUBLISH_SYNC=true` or no Redis |

## API endpoints

Base: `/api/v1` · Header: `X-Organization-Slug: demo`

| Brief | Implemented |
|-------|-------------|
| POST /channels | Done |
| GET /channels | Done |
| POST /channels/:id/mappings | Done |
| GET /channels/:id/mappings | Done |
| POST /publish/jobs | **ASSUMPTION CHANGE:** `POST /publish/dry-run` and `POST /publish/run` |
| GET /publish/jobs | Done |
| GET /publish/jobs/:id | Done (includes items) |
| GET /publish/jobs/:id/items | Included in job detail |
| GET /publish/jobs/:id/artifact | Done (file download) |
| POST /publish/jobs/:id/retry | Done |
| — | `GET /channels/:id/preview` |

## Eligibility

Products must be `APPROVED`, `PUBLISH_READY`, or `PUBLISHED`. Draft/rejected/in-review products are `SKIPPED` on job items.

Channel validation rules enforce allowed statuses and required mapped fields.

## Dry-run vs real

Both modes generate export files (CSV/JSON). `DRY_RUN` is labelled preview; `LIVE` is production-ready for channel ingestion. No external API push in MVP (**ASSUMPTION CHANGE:** file-based export only).

## Tests

```bash
pnpm --filter @productinfoman/publish-engine test
pnpm --filter @productinfoman/api test -- src/__tests__/publish-syndication.test.ts
```

## Deliverables checklist

- [x] Channels and field mappings persisted
- [x] Canonical → channel field mapping
- [x] Dry-run and live publish jobs
- [x] Export artifacts (CSV/JSON) with download
- [x] Job and item-level status tracking
- [x] Approved/published eligibility only
- [x] End-to-end export tests

## Out of scope (MVP)

Multiple complex channels, localization, AI transformation, storefront UI, push to live ecommerce APIs.
