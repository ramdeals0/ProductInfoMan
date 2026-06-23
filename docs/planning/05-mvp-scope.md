# MVP vs Later-Phase Scope

## Summary

**MVP goal:** Deliver a governed, taxonomy-driven product catalog with variants, validation, approval workflow, CSV/API import, basic facets, and publish readiness — without live channel syndication.

**MVP user story (epic):**  
*As a catalog manager, I can import products, assign categories and attributes, manage parent-child variants with inheritance, pass validation, obtain approval, and mark products publish-ready with a full audit trail.*

---

## Scope Matrix

| Capability | MVP | Phase 2 | Phase 3+ | Notes |
|------------|-----|---------|----------|-------|
| **Platform** | | | | |
| Multi-tenant SaaS foundation | Yes | | | Single-org pilot acceptable at first |
| PostgreSQL + API service | Yes | | | |
| Background job worker | Yes | | | Import jobs |
| Object storage for imports | Yes | | | |
| **Identity** | | | | |
| Email/password auth | Yes | | | |
| SSO / SAML | | Yes | | |
| RBAC (5 core roles) | Yes | | | |
| Category-scoped permissions | | Yes | | |
| **Product Master** | | | | |
| Simple products | Yes | | | |
| Parent products | Yes | | | |
| Variant (child) products | Yes | | | |
| Bundles | | | Yes | E12 |
| Collections | | | Yes | E12 |
| Soft delete | Yes | | | |
| Bulk edit | | Yes | | |
| **Taxonomy** | | | | |
| Category hierarchy CRUD | Yes | | | |
| Primary + secondary categories | Yes | | | |
| Category move/merge | | Yes | | |
| External taxonomy import | | | Yes | |
| **Attributes** | | | | |
| Attribute definitions (typed) | Yes | | | |
| Attribute groups | Yes | | | |
| Category attribute sets | Yes | | | |
| Global attributes | Yes | | | |
| Enum / LOV management | Yes | | | |
| Rich text attributes | Yes | | | |
| **Variants** | | | | |
| Variant axes per category | Yes | | | |
| Inheritance + overrides | Yes | | | |
| Variant matrix auto-generation | | Yes | | |
| Invalid combo blocking | | Yes | | |
| **Facets** | | | | |
| Direct attribute → facet rules | Yes | | | |
| Category-scoped facets | Yes | | | |
| Value normalization | | Yes | | |
| Facet preview/simulation | | Yes | | |
| Composite facets | | | Yes | |
| **Validation** | | | | |
| Required field rules | Yes | | | |
| Regex / type validation | Yes | | | |
| Category-bound rules | Yes | | | |
| Parent-child consistency | Yes | | | |
| Blocking vs warning | Yes | | | |
| Publish readiness checklist | Yes | | | |
| Channel-specific validation | | Yes | | |
| No-code rule builder UI | | | Yes | |
| **Workflow** | | | | |
| Draft → Review → Approved → Publish Ready → Published | Yes | | | |
| Single-step approval | Yes | | | |
| Multi-level approval | | Yes | | |
| Scheduled publish | | Yes | | |
| **Audit** | | | | |
| Field-level change log | Yes | | | |
| Workflow event log | Yes | | | |
| Import/export job log | Yes | | | |
| Configurable retention | | Yes | | |
| **Import** | | | | |
| CSV import + mapping | Yes | | | |
| Dry-run validation | Yes | | | |
| Upsert by SKU | Yes | | | |
| REST bulk import API | Yes | | | |
| ERP/source connectors | | Yes | | |
| Scheduled imports | | Yes | | |
| **Export / Publish** | | | | |
| Publish snapshot (immutable) | Yes | | | |
| Manual JSON/CSV export | Yes | | | Basic via export endpoint |
| Channel field mappings | | Yes | | E11 |
| Shopify / platform connectors | | Yes | | |
| Webhooks | | Yes | | |
| Delta export | | | Yes | |
| Scheduled syndication | | | Yes | E15 |
| **Media** | | | | |
| URL-based media references | Yes | | | |
| DAM integration | | | Yes | E13 |
| **AI** | | | | |
| AI attribute suggestions | | | Yes | E14 |
| Auto-generated descriptions | | | Yes | |
| **i18n** | | | | |
| Multi-language content model | Model only | | Yes | Fields designed for locale keys |
| Locale UI | | | Yes | |

---

## MVP Explicitly Out of Scope

- Live Shopify/Magento/Amazon push integrations
- Bundle and collection product types
- DAM asset sync
- AI enrichment pipelines
- Multi-level approval chains
- Category-scoped RBAC
- Facet value normalization
- Real-time inventory/price sync from ERP
- Multi-language UI
- Custom rule builder (rules configured via admin JSON/API only)
- Mobile app

---

## MVP Success Metrics

| Metric | Target |
|--------|--------|
| Time to onboard 1,000 SKUs via CSV | < 30 minutes including validation |
| Variant parent with 10 children created | < 15 minutes in UI |
| Validation feedback | 100% of blocking errors actionable |
| Audit coverage | 100% of mutations logged |
| Publish-ready accuracy | Zero published records with blocking validation failures |

---

## Phase 2 Additions (Post-MVP)

- Channel export with configurable mappings (E11)
- Advanced facet rules (normalization, preview)
- ERP connector framework
- SSO
- Scheduled publish and webhooks
- Bulk edit

---

## Phase 3+ Additions

- Bundles and collections (E12)
- DAM integration (E13)
- AI enrichment with review queue (E14)
- Multichannel orchestration, rollback, dependency ordering (E15)
- Multi-language content
- Marketplace-specific validation profiles

---

## Risk Register (Scope-Related)

| Risk | Mitigation |
|------|------------|
| Variant inheritance complexity underestimated | Spike in E6 before E7; limit MVP to 2 axes |
| Channel export expected in MVP | Set expectation: publish-ready + manual export only |
| Attribute schema churn | Version attribute definitions; migration tooling |
| Import formats vary widely | Mapping templates per source; dry-run mandatory |
| Facet rules too simple for launch | Phase 2 normalization; manual facet override post-MVP |
