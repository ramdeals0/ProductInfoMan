# Phase 8 — Integration and Eventing Spec Alignment

Phase 8 is **implemented** on top of Phases 1–7. Kafka/NATS and full webhook
subscriptions are out of scope for this MVP.

## Stack

Fastify · Prisma outbox · `packages/eventing` · BullMQ (`domain-events` queue) · Zod · sync fallback

## Schema mapping (ASSUMPTION CHANGEs)

| Brief table | Implementation | Notes |
|-------------|----------------|-------|
| `outbox_events` | `OutboxEvent` | Status: `PENDING`, `PUBLISHED`, `FAILED` |
| `event_consumption_log` | `EventConsumptionLog` | Unique `(eventId, consumerName, idempotencyKey)` |
| `dead_letter_events` | `DeadLetterEvent` | Per event + consumer |
| — | `IntegrationEvent` | Dispatch/delivery tracking |
| — | `IntegrationEndpoint` | Schema only (webhooks deferred) |
| — | `IntegrationRetry` | Created on DLQ; no scheduled worker yet |

Indexes: status, eventType, aggregateType/aggregateId, occurredAt.

## Event types (`packages/eventing`)

| Brief type | Implemented | Notes |
|------------|-------------|-------|
| `product.created` | Yes | |
| `product.updated` | Yes | |
| `product.deleted` | Yes | |
| `product.variant.created` | Yes | |
| `product.variant.updated` | **No** | Use `product.updated` / `attributes_changed` |
| `workflow.state.changed` | Yes | |
| `import.job.completed` | Yes | |
| `import.job.failed` | Yes | Added in Phase 8 alignment |
| `publish.job.completed` | Yes | |
| `publish.job.failed` | Yes | Added in Phase 8 alignment |
| `search.reindex.requested` | `search.index.requested` | **ASSUMPTION CHANGE** naming |
| `audit.record.created` | Yes | Emitted after sync audit writes |

Each event has Zod schema + `eventVersion` (default 1).

## Publisher

| Brief | Implementation |
|-------|----------------|
| `EventPublisher.publishEvent` | `publishDomainEvent()` / `EventPublisher.publish` |
| Validate + outbox insert | `integration.publisher.ts` |
| Service emit helper | `emitEvent()` → `publishDomainEvent` |

**ASSUMPTION CHANGE:** dispatch is push-on-write (enqueue after outbox insert), not a periodic outbox poller.

**ASSUMPTION CHANGE:** domain write and outbox insert are not in a single DB transaction (sequential calls).

## Dispatcher

| Brief | Implementation |
|-------|----------------|
| Read pending → enqueue | `enqueueEventDispatch` on publish |
| Mark published | `dispatchOutboxEvent()` |
| Route to consumers | `getConsumersForEventType()` + `runConsumer()` |

Queue name: `domain-events` (not generic `events`).

## Consumers

| Brief consumer | Implementation | Behavior |
|----------------|----------------|----------|
| SearchConsumer | `search-sync` | Indexes/removes products via `handleProductChange` |
| PublishConsumer | `publish-sync` | Eligibility hook (publish via dedicated queue) |
| AuditConsumer | `audit-sync` | Writes `audit_logs` from events (`source: eventing`) |
| ReportingConsumer | `reporting-sync` | Records `MetricObservation` rows |
| — | `notification-sync` | No-op placeholder |

Idempotency: `EventConsumptionLog` + `buildIdempotencyKey`. Max attempts: **3** (spec suggests 5).

## API endpoints

Base: `/api/v1` · Header: `X-Organization-Slug: demo`

| Brief | Implemented |
|-------|-------------|
| GET /events/outbox | Done |
| GET /events/:id | Done |
| GET /events/dead-letter | Done |
| POST /events/:id/retry | Done |
| POST /events/replay | Done |

## Wired producers

| Service | Events |
|---------|--------|
| Product Core | `product.*` |
| Workflow | `workflow.state.changed`, `workflow.approval.recorded` |
| Import | `import.job.completed`, `import.job.failed` |
| Publishing | `publish.job.requested`, `publish.job.completed`, `publish.job.failed` |
| Taxonomy | `taxonomy.category.created`, `taxonomy.facet.updated` |
| Audit helper | `audit.record.created` |

## Tests (`integration-eventing.test.ts`)

| Spec §8 criterion | Test |
|-------------------|------|
| Outbox via EventPublisher | `writes validated domain events to the outbox via EventPublisher` |
| Dispatcher + consumer dispatch | `stores emitted domain events in the outbox and dispatches consumers` |
| Idempotent consumption | `processes consumers idempotently on replay` |
| workflow → search + audit | `routes workflow.state.changed to search and audit consumers` |
| Dead-letter on failure | `inserts dead-letter events after repeated consumer failures` |
| Replay/retry APIs | `supports replay and retry APIs` |

## Phase 8 acceptance criteria

| Criterion | Status |
|-----------|--------|
| Outbox + consumption + dead-letter tables | ✅ |
| EventPublisher used by Product Core and Workflow | ✅ |
| Dispatcher moving pending events to queue | ✅ |
| SearchConsumer + AuditConsumer processing events | ✅ |
| Dead-letter and retry behavior | ✅ |
| /events/outbox, /events/dead-letter, /events/:id/retry | ✅ |
| End-to-end product.created + workflow.state.changed tests | ✅ |
