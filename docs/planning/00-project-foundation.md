# ProductInfoMan — Project Foundation

> **Status:** First-pass planning artifact  
> **Audience:** Product, engineering, operations, merchandising  
> **Purpose:** Establish vision, scope, domain model, epics, and delivery plan before implementation

---

## Project Vision

Build a governed **Product Information Management (PIM) platform** that serves as the single source of truth for ecommerce product data. The platform centralizes product onboarding, enrichment, validation, and publishing so merchandising teams can manage complex catalogs—variants, bundles, taxonomy, and facets—without duplicating data across channels.

Inspired by retail-grade PIM systems, ProductInfoMan prioritizes **data quality, configurability, and auditability** over feature breadth in the MVP. The long-term vision is multichannel syndication to ecommerce platforms, marketplaces, ERP, and DAM systems, with future support for AI-assisted enrichment and automation.

---

## Objectives

| # | Objective | Success Indicator |
|---|-----------|-------------------|
| O1 | Centralize product master data | One authoritative record per sellable item / variant |
| O2 | Support governed enrichment workflows | Draft → review → approve → publish with audit trail |
| O3 | Model complex product relationships | Parent-child, variants, bundles, collections |
| O4 | Enable taxonomy-driven attribute governance | Category-specific attribute sets and validation |
| O5 | Generate navigational facets from attributes | Rule-based facet derivation, not manual duplication |
| O6 | Prepare for channel export | Configurable mappings; MVP validates publish readiness |
| O7 | Design for SaaS scale | Multi-tenant foundation, modular services, API-first |

---

## In-Scope (Planning Phase)

- Requirements definition and domain modeling
- Epic breakdown and phased delivery plan
- MVP vs later-phase scope boundaries
- Discovery workshop questionnaire
- Repository and architecture outlines
- Entity relationship model (logical, not physical schema)
- Workflow and validation rule framework (conceptual)

## Out-of-Scope (Planning Phase)

- Production application code
- UI screens and components
- Database migrations beyond exploratory prototypes
- Live integrations with Shopify, Magento, ERP, or DAM
- AI enrichment pipelines (planned, not built)
- Performance benchmarking or infrastructure provisioning

---

## Stakeholders

| Role | Interest | Primary Concerns |
|------|----------|------------------|
| **Merchandising / Catalog Manager** | Create and enrich products | Usability, bulk edit, variant management |
| **Taxonomy / Data Governance** | Categories, attributes, facets | Consistency, inheritance rules, validation |
| **Ecommerce Operations** | Publish to storefronts | Export mappings, readiness checks, scheduling |
| **Engineering** | Build and operate platform | Extensibility, APIs, tenancy, observability |
| **Compliance / Legal** | Claims, regulated attributes | Audit trail, approval gates, immutability |
| **Integration / IT** | Source systems, ERP, DAM | Import pipelines, webhooks, idempotency |
| **Executive Sponsor** | Time-to-value, ROI | MVP scope discipline, roadmap clarity |

---

## Epics (Summary)

| Epic | Name | Phase |
|------|------|-------|
| E1 | Platform Foundation & Tenancy | MVP |
| E2 | Identity, Roles & Permissions | MVP |
| E3 | Product Master Data | MVP |
| E4 | Taxonomy & Category Hierarchy | MVP |
| E5 | Attribute Groups & Category Attribute Sets | MVP |
| E6 | Parent-Child & Variant Model | MVP |
| E7 | Validation Engine & Publish Readiness | MVP |
| E8 | Workflow, Approvals & Audit Trail | MVP |
| E9 | Import Pipeline (CSV + API) | MVP |
| E10 | Facet Generation Rules | MVP (basic) |
| E11 | Channel Export & Syndication | Post-MVP |
| E12 | Bundles & Collections | Post-MVP |
| E13 | DAM Integration | Later |
| E14 | AI Enrichment & Automation | Later |
| E15 | Advanced Multichannel Orchestration | Later |

Detailed epic definitions: [02-epics-and-phases.md](./02-epics-and-phases.md)

---

## Data Model (Logical Overview)

Core entity groups:

1. **Catalog** — Product, SKU, Variant, ProductRelationship (parent-child, bundle, accessory)
2. **Taxonomy** — Category, CategoryHierarchy, CategoryAttributeSet
3. **Attributes** — AttributeDefinition, AttributeGroup, AttributeValue, InheritanceRule
4. **Facets** — FacetDefinition, FacetRule, FacetValue (derived)
5. **Governance** — WorkflowState, ApprovalRecord, ValidationRule, ValidationResult
6. **Publishing** — Channel, ChannelMapping, ExportJob, PublishSnapshot
7. **Operations** — ImportJob, ImportMapping, AuditLog, ChangeEvent
8. **Platform** — Organization, User, Role, Permission

Full entity relationship outline: [03-domain-model.md](./03-domain-model.md)

---

## Workflow (Conceptual)

### Product Lifecycle States

```
DRAFT → IN_REVIEW → APPROVED → PUBLISH_READY → PUBLISHED
          ↓              ↓
       REJECTED      CHANGES_REQUESTED → (back to DRAFT or IN_REVIEW)
```

### Governance Principles

- **Draft:** editable by creators; no external export
- **In Review:** locked for structural changes; comments allowed
- **Approved:** content frozen for approval scope; validation re-run on change
- **Publish Ready:** all blocking validations pass for target channel(s)
- **Published:** immutable snapshot created; live record may continue in draft overlay (assumption: dual-version model)

### Validation Gates (Blocking vs Warning)

| Gate | Type | Example |
|------|------|---------|
| Required attributes for category | Blocking | Missing `color` on Apparel child |
| Unique SKU | Blocking | Duplicate SKU in tenant |
| Parent-child consistency | Blocking | Child missing variant axis values |
| Image minimum count | Warning | Fewer than 1 image |
| SEO title length | Warning | Title > 60 chars |
| Channel-specific required fields | Blocking (per channel) | Missing `price` for Shopify export |

---

## Open Questions

See [04-discovery-workshop.md](./04-discovery-workshop.md) for the full workshop questionnaire.

**Critical unresolved items (first-pass assumptions applied where noted):**

1. Is PIM the system of record, or does ERP own SKU/inventory? *(Assumption: PIM owns merchandising attributes; ERP owns cost/inventory via future sync)*
2. What product types are in scope for MVP? *(Assumption: simple, variant, and parent-child only; bundles deferred)*
3. Single brand or multi-brand per tenant? *(Assumption: multi-brand supported in model, single-brand MVP)*
4. Approval: one-step or multi-level? *(Assumption: single approver role for MVP)*
5. Publish model: push vs pull? *(Assumption: export job generates payload; channel pull API post-MVP)*

---

## Delivery Phases

| Phase | Focus | Duration Guidance |
|-------|-------|-------------------|
| **Phase 0 — Discovery** | Workshops, decisions, refine MVP | Before sprint 1 |
| **Phase 1 — MVP Core** | E1–E9, basic E10 | Foundation + governed catalog |
| **Phase 2 — Syndication** | E11, advanced E10 | Channel export, scheduling |
| **Phase 3 — Complex Catalog** | E12 | Bundles, collections, kits |
| **Phase 4 — Ecosystem** | E13–E15 | DAM, AI, orchestration |

MVP backlog order: [02-epics-and-phases.md#recommended-mvp-backlog-order](./02-epics-and-phases.md#recommended-mvp-backlog-order)

---

## Assumptions (Labeled)

| ID | Assumption |
|----|------------|
| A1 | TypeScript-first monorepo with API + worker modules |
| A2 | Multi-tenant SaaS; tenant = retailer organization |
| A3 | PostgreSQL as primary datastore; object storage for import files |
| A4 | Event-driven internal architecture for audit and async jobs |
| A5 | Rule engine is configuration-driven (JSON/YAML or DB-stored rules), not hardcoded per retailer |
| A6 | MVP targets B2C ecommerce catalog patterns (SKU-level sellable units) |
| A7 | English-only content for MVP; i18n modeled but not implemented |
| A8 | No real-time inventory sync in MVP |

---

## Related Documents

| Document | Description |
|----------|-------------|
| [01-requirements.md](./01-requirements.md) | Functional and non-functional requirements |
| [02-epics-and-phases.md](./02-epics-and-phases.md) | Epic details, acceptance criteria, backlog order |
| [03-domain-model.md](./03-domain-model.md) | Entity relationship outline |
| [04-discovery-workshop.md](./04-discovery-workshop.md) | Workshop questionnaire |
| [05-mvp-scope.md](./05-mvp-scope.md) | MVP vs later-phase matrix |
| [06-repo-structure.md](./06-repo-structure.md) | Proposed repository layout |
| [07-architecture-outline.md](./07-architecture-outline.md) | Technical architecture (no implementation) |
