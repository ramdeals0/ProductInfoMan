# Requirements Document — ProductInfoMan PIM

## 1. Document Control

| Field | Value |
|-------|-------|
| Product | ProductInfoMan |
| Type | Ecommerce Product Information Management Platform |
| Version | 0.1 (Planning) |

---

## 2. Business Requirements

### BR-1 Single Source of Truth
The platform must maintain one authoritative product record per catalog item, with version history and audit trail. Downstream channels consume published snapshots, not draft data.

### BR-2 Governed Data Quality
Product data must pass configurable validation before publishing. Merchandisers receive actionable error and warning feedback.

### BR-3 Catalog Complexity
The platform must support parent products, child variants, attribute inheritance with overrides, and (post-MVP) bundles and collections.

### BR-4 Taxonomy-Driven Attributes
Attribute requirements must vary by category. Global attributes apply to all products; category-specific attributes apply only within assigned taxonomy branches.

### BR-5 Faceted Navigation Support
Facets for ecommerce browse/filter must be derivable from product attributes via configurable rules, reducing duplicate facet maintenance.

### BR-6 Multichannel Readiness (Future)
Architecture must support channel-specific field mappings and export formats without restructuring core product data.

### BR-7 Traceability
All create, update, approve, publish, and import actions must be auditable with actor, timestamp, and before/after state.

---

## 3. Functional Requirements

### 3.1 Product Master Data

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PM-01 | Create, read, update, soft-delete product records | MVP |
| FR-PM-02 | Assign product type: Simple, Parent, Variant, Bundle*, Collection* | MVP (Bundle/Collection later) |
| FR-PM-03 | Manage SKU as unique sellable identifier per tenant | MVP |
| FR-PM-04 | Store core fields: title, description, brand, status, identifiers (GTIN, MPN) | MVP |
| FR-PM-05 | Support custom attributes via attribute definitions | MVP |
| FR-PM-06 | Link products to one or more taxonomy categories | MVP |
| FR-PM-07 | Attach media references (URL/asset ID); DAM integration later | MVP (URL only) |
| FR-PM-08 | Search and filter products by SKU, title, category, status | MVP |
| FR-PM-09 | Bulk update selected attributes | Post-MVP |

### 3.2 Taxonomy & Category Hierarchy

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-TX-01 | Maintain hierarchical category tree (multi-level) | MVP |
| FR-TX-02 | Assign products to primary and secondary categories | MVP |
| FR-TX-03 | Category path breadcrumb resolution | MVP |
| FR-TX-04 | Category merge/move with impact preview | Post-MVP |
| FR-TX-05 | External taxonomy import (e.g., Google Product Category) | Later |

### 3.3 Attribute Groups & Category Attribute Sets

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AG-01 | Define attribute definitions: key, label, data type, constraints | MVP |
| FR-AG-02 | Group attributes into logical attribute groups (e.g., Dimensions, Marketing) | MVP |
| FR-AG-03 | Bind attribute sets to categories (required/optional/hidden per attribute) | MVP |
| FR-AG-04 | Support data types: text, rich text, number, boolean, enum, date, URL, JSON | MVP |
| FR-AG-05 | Enum/list-of-values management with allowed values | MVP |
| FR-AG-06 | Attribute-level help text and validation regex | MVP |
| FR-AG-07 | Global attribute library reusable across categories | MVP |

### 3.4 Variant & Parent-Child Rules

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-VAR-01 | Parent product holds shared content (title base, description, brand) | MVP |
| FR-VAR-02 | Variant axes defined per category (e.g., Color, Size) | MVP |
| FR-VAR-03 | Child variants inherit parent attribute values by default | MVP |
| FR-VAR-04 | Child may override inherited values explicitly | MVP |
| FR-VAR-05 | System indicates inherited vs overridden vs local values | MVP |
| FR-VAR-06 | Prevent invalid variant combinations via rules | Post-MVP |
| FR-VAR-07 | Auto-generate variant matrix from axis values | Post-MVP |

### 3.5 Facet Generation Rules

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-FC-01 | Define facet from attribute + transformation rule | MVP (basic) |
| FR-FC-02 | Facet scope: global or category-specific | MVP |
| FR-FC-03 | Facet value normalization (e.g., "Navy Blue" → "Blue") | Post-MVP |
| FR-FC-04 | Facet sort order and display label configuration | MVP |
| FR-FC-05 | Preview facets for a category/product set | Post-MVP |

### 3.6 Workflow & Approval States

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-WF-01 | Product lifecycle states: Draft, In Review, Approved, Publish Ready, Published | MVP |
| FR-WF-02 | Submit for review; assign reviewer | MVP |
| FR-WF-03 | Approve, reject, request changes with comments | MVP |
| FR-WF-04 | State transition permissions by role | MVP |
| FR-WF-05 | Multi-step approval chains | Post-MVP |
| FR-WF-06 | Scheduled publish | Post-MVP |

### 3.7 Data Validation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-VAL-01 | Rule engine: required fields, type checks, regex, cross-field rules | MVP |
| FR-VAL-02 | Category-bound validation (attribute set requirements) | MVP |
| FR-VAL-03 | Parent-child consistency validation | MVP |
| FR-VAL-04 | Blocking vs warning severity | MVP |
| FR-VAL-05 | Publish readiness score / checklist UI | MVP |
| FR-VAL-06 | Channel-specific validation profiles | Post-MVP |
| FR-VAL-07 | Custom rule DSL or no-code rule builder | Later |

### 3.8 Publishing & Syndication

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PUB-01 | Mark product publish-ready when validations pass | MVP |
| FR-PUB-02 | Create immutable publish snapshot | MVP |
| FR-PUB-03 | Channel definition: name, type, field mapping config | Post-MVP |
| FR-PUB-04 | Export job: filter, transform, deliver payload | Post-MVP |
| FR-PUB-05 | Webhook notification on publish | Post-MVP |
| FR-PUB-06 | Delta export since last publish | Later |

### 3.9 Audit Logging

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUD-01 | Log all mutations with actor, entity, field-level diff | MVP |
| FR-AUD-02 | Log workflow transitions and approval decisions | MVP |
| FR-AUD-03 | Log import/export job outcomes | MVP |
| FR-AUD-04 | Searchable audit history per product | MVP |
| FR-AUD-05 | Retention policy configuration | Post-MVP |

### 3.10 Roles & Permissions

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-RBAC-01 | Tenant-scoped users and roles | MVP |
| FR-RBAC-02 | Permissions: create, edit, review, approve, publish, import, admin | MVP |
| FR-RBAC-03 | Category-scoped edit permissions | Post-MVP |
| FR-RBAC-04 | Attribute-level read/write restrictions | Later |
| FR-RBAC-05 | SSO / SAML | Post-MVP |

### 3.11 Import / Export Pipelines

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-IE-01 | CSV import with column-to-attribute mapping | MVP |
| FR-IE-02 | Import validation report before commit | MVP |
| FR-IE-03 | Upsert by SKU | MVP |
| FR-IE-04 | REST API for product CRUD and bulk import | MVP |
| FR-IE-05 | Source system connector framework | Post-MVP |
| FR-IE-06 | CSV/JSON export of published catalog | MVP |
| FR-IE-07 | Import job scheduling and retry | Post-MVP |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Scalability | Support 100K+ SKUs per tenant; horizontal API scaling |
| NFR-02 | Performance | Product search < 500ms p95 for typical filters |
| NFR-03 | Availability | 99.9% target for SaaS MVP |
| NFR-04 | Security | Tenant isolation, encryption at rest and in transit |
| NFR-05 | Extensibility | Plugin points for validation rules, transforms, connectors |
| NFR-06 | Observability | Structured logging, metrics, distributed tracing |
| NFR-07 | API-first | OpenAPI-documented REST; event webhooks internal |
| NFR-08 | Configurability | Business rules stored as data, not code branches |
| NFR-09 | Compliance | GDPR-ready data export/delete per tenant |
| NFR-10 | Maintainability | TypeScript monorepo, clear module boundaries |

---

## 5. Integration Requirements (Future)

| System | Direction | Purpose |
|--------|-----------|---------|
| Shopify / BigCommerce / Magento | Export | Storefront catalog sync |
| ERP (NetSuite, SAP) | Bi-directional | SKU, cost, inventory metadata |
| DAM (Bynder, Cloudinary) | Pull | Rich media assets |
| MDM / Data Warehouse | Export | Analytics and reporting |
| AI Services | Async enrich | Descriptions, attribute suggestions |

---

## 6. Constraints

- MVP must not require custom code per retailer for standard catalog patterns
- No hardcoded category trees in application code
- Publishing must never expose non-approved attribute values
- Import must be idempotent on SKU

---

## 7. Glossary

| Term | Definition |
|------|------------|
| **PIM** | Product Information Management |
| **Parent** | Non-sellable or optionally sellable grouping product holding shared data |
| **Variant / Child** | Sellable SKU differentiated by variant axes |
| **Attribute Set** | Collection of attribute definitions required for a category |
| **Facet** | Navigational filter dimension derived from product data |
| **Publish Snapshot** | Immutable approved version of a product for export |
| **Syndication** | Distribution of product data to external channels |
