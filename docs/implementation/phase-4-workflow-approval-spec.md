# Phase 4 — Workflow and Approval Spec Alignment

Phase 4 is **implemented** on top of Phases 1–3. Search indexing, publishing
integrations, and admin UI are separate phases.

## Stack

Fastify · Prisma · Zod · `packages/workflow-engine` · optional Redis/BullMQ (not required for workflow)

## Schema mapping (ASSUMPTION CHANGEs)

| Brief table / field | Implementation | Notes |
|---------------------|----------------|-------|
| `products.workflow_state_code` | `Product.status` (`ProductStatus` enum) | **ASSUMPTION CHANGE:** workflow state stored on product; synced via WorkflowService only |
| `workflow_state` codes lowercase | `DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`, `REJECTED`, `ARCHIVED` | Uppercase enum values |
| `workflow_states` | `WorkflowState` | Linked to `productStatus` per state |
| `allowed_roles_json` | `WorkflowTransition.allowedRoles` (JSON array) | Values: `ADMIN`, `CATALOG_MANAGER`, `EDITOR`, `REVIEWER`, `VIEWER` |
| `workflow_tasks.assigned_to_user_id` | `assignedToUserId` + `assignedRole` | **ASSUMPTION CHANGE:** role-based routing via `WorkflowAssignmentRule` |
| `workflow_history.performed_by` | `performedById` + actor from `X-User-Email` header | |
| `metadata_json` | `WorkflowHistory.metadata` (JSON) | Comments, reasons |
| — | `WorkflowAssignmentRule` | **ASSUMPTION CHANGE:** task routing by role/category/product type |
| — | `PUBLISH_READY` status | Extra gate before external publish (Phase 6) |

State machine logic: `packages/workflow-engine` (`validateTransition`, `checkPublishReadiness`, `resolveAssignmentRole`).

## Domain types (`packages/domain`)

| Brief type | Export |
|------------|--------|
| WorkflowDefinition | `WorkflowDefinitionEntity` |
| WorkflowState | `WorkflowStateEntity` |
| WorkflowTransition | `WorkflowTransitionEntity` |
| WorkflowTask | `WorkflowTaskEntity` |
| WorkflowApproval | `WorkflowApprovalEntity` |
| WorkflowHistory | `WorkflowHistoryEntity` |
| Transition result | `WorkflowTransitionResult` |

## Validation (`packages/validation`)

| Brief schema | Zod export |
|--------------|------------|
| SubmitForReviewInput | `WorkflowDecisionSchema` (optional reason/comments) |
| ApproveProductInput | `WorkflowDecisionSchema` (reason optional unless transition requires) |
| RejectProductInput | `WorkflowRejectSchema` (reason required) |
| PublishProductInput | `WorkflowDecisionSchema` |
| Create workflow definition | `CreateWorkflowDefinitionSchema` |
| List tasks | `ListWorkflowTasksQuerySchema` |

## API endpoints

Base: `/api/v1` · Headers: `X-Organization-Slug: demo`, `X-User-Email`, `X-Actor-Role`

| Brief | Implemented |
|-------|-------------|
| POST /products/:id/workflow/submit | Done |
| POST /products/:id/workflow/approve | Done |
| POST /products/:id/workflow/reject | Done |
| POST /products/:id/workflow/publish | Done |
| GET /products/:id/workflow/history | Done |
| GET /workflow/tasks | Done (+ `GET /workflow/tasks/:id`) |
| GET /workflow/definitions | Done (+ `POST /workflow/definitions`) |

## Workflow service (`workflow.service.ts`)

| Brief method | Implementation |
|--------------|----------------|
| `initializeProductWorkflow` | **ASSUMPTION CHANGE:** `Product.status` defaults to `DRAFT`; task created on first transition |
| `submitForReview` | `submitProduct()` |
| `approveProduct` | `approveProduct()` |
| `rejectProduct` | `rejectProduct()` |
| `publishProduct` | `publishProduct()` + `checkPublishReadiness()` |

All transitions go through `executeTransition()` which:

1. Loads active workflow definition
2. Validates from/to state + role via `workflow-engine`
3. Updates `Product.status`
4. Creates/updates `WorkflowTask` and `WorkflowApproval`
5. Writes `WorkflowHistory` + audit log
6. Emits domain events

## MVP state machine (seeded)

```
DRAFT ──submit──► IN_REVIEW ──approve──► APPROVED ──publish──► PUBLISHED
                     │
                     └──reject──► REJECTED
```

Role gating (example from seed):

| Action | Allowed roles |
|--------|---------------|
| SUBMIT | EDITOR, CATALOG_MANAGER |
| APPROVE | REVIEWER, ADMIN |
| REJECT | REVIEWER, ADMIN (requires justification) |
| PUBLISH | CATALOG_MANAGER, ADMIN |

## Tests

```bash
pnpm --filter @productinfoman/workflow-engine test
pnpm --filter @productinfoman/api test -- src/__tests__/workflow-approval.test.ts
```

## Deliverables checklist

- [x] Workflow tables + product status wired through WorkflowService
- [x] Submit, approve, reject, publish endpoints
- [x] Publish blocked unless approved
- [x] Workflow history per transition
- [x] Role-based transition gating
- [x] Tests for valid and invalid transitions

## Out of scope (later phases)

Search indexing, publishing channel exports (Phase 6), multi-stage approval trees, admin UI (Phase 8).
