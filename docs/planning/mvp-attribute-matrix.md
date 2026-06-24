# MVP Attribute Matrix

> **Status:** Template with example rows — replace with real catalog data  
> **Purpose:** Define global vs category-specific attributes and validation requirements  
> **Used by:** Taxonomy service, Validation engine, Import mapping

---

## Global Attributes

Apply to all products regardless of category.

| Key | Label | Group | Data Type | Required | Variant Axis | Inheritable | Facet Source | Notes |
|-----|-------|-------|-----------|----------|--------------|-------------|--------------|-------|
| `brand` | Brand | Marketing | ENUM | Yes | No | Yes | Yes | _Example_ |
| `title` | Title | Marketing | TEXT | Yes | No | Yes | No | Max 255 chars |
| `description` | Description | Marketing | RICH_TEXT | Yes | No | Yes | No | |
| `gtin` | GTIN | Identifiers | TEXT | No | No | No | No | Regex: `^[0-9]{8,14}$` |
| _add rows_ | | | | | | | | |

---

## Category: Apparel / Mens / Shirts

_Path: `/apparel/mens/shirts` — replace with real category_

| Key | Label | Group | Data Type | Required | Variant Axis | Inheritable | Facet Source | Notes |
|-----|-------|-------|-----------|----------|--------------|-------------|--------------|-------|
| `color` | Color | Specifications | ENUM | Yes | **Yes** | No | Yes | Facet: DIRECT |
| `size` | Size | Specifications | ENUM | Yes | **Yes** | No | Yes | Facet: DIRECT |
| `fabric` | Fabric | Specifications | TEXT | Optional | No | Yes | Yes | |
| `fit` | Fit | Specifications | ENUM | Optional | No | Yes | Yes | slim, regular, relaxed |
| _add rows_ | | | | | | | | |

---

## Category: Electronics / Accessories

_Path: `/electronics/accessories` — replace with real category_

| Key | Label | Group | Data Type | Required | Variant Axis | Inheritable | Facet Source | Notes |
|-----|-------|-------|-----------|----------|--------------|-------------|--------------|-------|
| `color` | Color | Specifications | ENUM | Optional | **Yes** | No | Yes | |
| `compatibility` | Compatibility | Specifications | TEXT | Yes | No | Yes | Yes | |
| _add rows_ | | | | | | | | |

---

## Inheritance Rules (MVP)

| Field / Attribute | Parent → Child | Override allowed |
|-------------------|----------------|------------------|
| `title` | Inherit base; child may append axis suffix | Yes |
| `description` | Inherit | Yes |
| `brand` | Inherit | No (MVP) |
| Variant axis values (`color`, `size`) | Not inherited | Local only |
| Images | Inherit primary; child may override swatch | Yes |

---

## Facet Mapping (MVP — DIRECT only)

| Facet Key | Source Attribute | Scope | Category |
|-----------|------------------|-------|----------|
| `brand` | `brand` | Global | — |
| `color` | `color` | Category | `/apparel/mens/shirts` |
| `size` | `size` | Category | `/apparel/mens/shirts` |
| _add rows_ | | | |

---

## Validation Rules Derived from Matrix

| Rule | Scope | Severity | Expression |
|------|-------|----------|------------|
| Required global fields | Global | Blocking | `brand`, `title`, `description` present |
| Required category fields | Category | Blocking | Per matrix `Required=Yes` |
| Variant axes complete | VARIANT | Blocking | All `Variant Axis=Yes` attrs populated |
| GTIN format | Global | Warning | Regex if present |

---

## Workshop Checklist

- [ ] Global attribute list confirmed
- [ ] At least 2 MVP categories fully defined
- [ ] Variant axes identified per variant category
- [ ] Inheritance/overrides agreed
- [ ] Facet sources mapped (DIRECT only for MVP)
- [ ] Linked from [decision-log.md](./decision-log.md) D11, D12, D21
