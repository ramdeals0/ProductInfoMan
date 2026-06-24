# Phase 7 — Audit and Reporting Spec Alignment

Phase 7 is **implemented** on top of Phases 1–6. Heavy BI/visualization and external
SIEM integration are out of scope for this MVP.

## Stack

Fastify · Prisma · `packages/shared` audit helpers · Zod · on-the-fly report computation

## Schema mapping (ASSUMPTION CHANGEs)

| Brief table / field | Implementation | Notes |
|---------------------|----------------|-------|
| `audit_logs` | `AuditLog` | Extended with `beforeJson`, `afterJson`, `changedFieldsJson`, `source` |
| `performed_by` | `actorId` | FK to `User` deferred for MVP |
| `action_type` `workflow_transition` | `AuditAction.STATE_CHANGE` | |
| `entity_change_history` | `EntityChangeHistory` | `changeType` enum: SNAPSHOT, CREATE, UPDATE, DELETE |
| `metric_definitions` | `MetricDefinition` | **ASSUMPTION CHANGE:** org-scoped, not global |
| `metric_observations` | `MetricObservation` | Table present; observations stored on-demand in future |
| `report_snapshots` | `ReportSnapshot` | Table present; MVP computes reports on-the-fly |
| `DailyMetricRollup` (roadmap) | Not implemented | Reports query operational tables directly |

Indexes: `AuditLog` by entity, createdAt, actorId; `EntityChangeHistory` by entity + version.

## Audit hook strategy

| Brief method | Implementation |
|--------------|----------------|
| `recordChange` | `packages/shared/src/audit.ts` → `recordChange()` |
| `recordSnapshot` | `packages/shared/src/audit.ts` → `recordSnapshot()` |
| `writeAudit` (legacy) | Thin wrapper over `recordChange` |

Integration (direct service calls):

| Service | Audited operations |
|---------|-------------------|
| Product Core | create, update, delete, set attributes |
| Workflow | state transitions (`source: workflow`) |
| Import | upload, completion, failure (`source: import`) |
| Publishing | publish job completion (`source: publishing`, action EXPORT) |
| Taxonomy | category/attribute/facet mutations (existing) |

Event-driven `audit.write` BullMQ job: **not implemented** — synchronous writes for MVP.

## Change history

- Product **create** → audit log + version 1 snapshot (`changeType: CREATE`)
- Product **update** → audit log with before/after + new snapshot version
- Product **delete** → audit log + snapshot (`changeType: DELETE`)

Endpoint: `GET /api/v1/entities/:entityType/:entityId/history`

## Metrics and reporting

| Brief metric | Implementation |
|--------------|----------------|
| `product_completeness` | `computeProductCompletenessScore()` — required attrs present |
| `workflow_throughput` | `computeWorkflowReport()` — transitions to APPROVED/PUBLISHED |
| `import_success_rate` | `computeImportReport()` — valid_rows / total_rows |
| `publish_success_rate` | `computePublishReport()` — successful_items / total_items |

Completeness: **Option A** — computed on read in `ReportingService` (not stored on product).

| Brief method | Implementation |
|--------------|----------------|
| `computeDashboard` | `computeDashboard()` |
| `computeCompletenessReport` | `computeCompletenessReport()` |
| `computeWorkflowReport` | `computeWorkflowReport()` |
| `computeImportReport` | `computeImportReport()` |
| `computePublishReport` | `computePublishReport()` |
| Operations summary (admin) | `getOperationsReport()` — kept for Phase 8 admin UI |

## Domain types (`packages/domain`)

| Brief type | Export |
|------------|--------|
| Audit log | `AuditLogEntity` (extended) |
| Change history | `EntityChangeHistoryEntity` |
| Dashboard | `DashboardReportEntity` |
| Completeness | `CompletenessReportEntity` |
| Workflow report | `WorkflowReportEntity` |
| Import report | `ImportReportEntity` |
| Publish report | `PublishReportEntity` |
| Admin ops summary | `OperationsReportEntity` |

## Validation (`packages/validation`)

| Brief schema | Zod export |
|--------------|------------|
| Audit list filters | `ListAuditQuerySchema` (+ `performedBy`) |
| Report period | `ReportPeriodQuerySchema` |

## API endpoints

Base: `/api/v1` · Header: `X-Organization-Slug: demo`

| Brief | Implemented |
|-------|-------------|
| GET /audit/logs | `GET /api/v1/audit/logs` (alias: `/audit`) |
| GET /audit/logs/:id | `GET /api/v1/audit/:id` |
| GET /entities/:type/:id/history | `GET /api/v1/entities/:entityType/:entityId/history` |
| GET /reports/dashboard | Done |
| GET /reports/completeness | Done |
| GET /reports/workflow | Done |
| GET /reports/imports | Done |
| GET /reports/publishes | Done |
| — | `GET /api/v1/reports/summary` (Phase 8 admin dashboard) |

## Tests (`audit-reporting.test.ts`)

| Spec §7 criterion | Test |
|-------------------|------|
| Audit on product create/update | `creates audit logs on product create and update` |
| Audit on workflow transitions | `creates audit logs on workflow transitions` |
| History snapshots versioned | `versions entity change history snapshots` |
| Dashboard aggregated metrics | `returns dashboard report with aggregated metrics` |
| Completeness plausible scores | `returns completeness report with plausible scores` |

## Phase 7 acceptance criteria

| Criterion | Status |
|-----------|--------|
| audit_logs + entity_change_history populated from core services | ✅ |
| /audit/logs and /entities/:type/:id/history endpoints | ✅ |
| /reports/dashboard and key report endpoints | ✅ |
| Tests verifying audit records and report calculations | ✅ |
