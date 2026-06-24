# MVP CSV Import Specification

> **Status:** Template — confirm with stakeholders (D33, D36)  
> **Format:** CSV only for MVP  
> **Upsert key:** SKU (`organizationId` + `sku`)  
> **Behavior:** Dry-run required before commit

---

## File Requirements

| Property | Value |
|----------|-------|
| Encoding | UTF-8 |
| Delimiter | Comma (`,`) |
| Header row | Required (row 1) |
| Max rows (MVP) | 10,000 per job |
| Storage | S3/MinIO before processing |

---

## Column Specification

### Core columns (required)

| Column | Maps to | Type | Required | Notes |
|--------|---------|------|----------|-------|
| `sku` | `Product.sku` | string | Yes | Upsert key; unique per tenant |
| `product_type` | `Product.productType` | enum | Yes | `SIMPLE`, `PARENT`, `VARIANT` |
| `parent_sku` | `Product.parentId` (lookup) | string | If VARIANT | Must reference existing PARENT |
| `title` | `Product.title` | string | Yes | |
| `description` | `Product.description` | string | Yes | Plain text in MVP |
| `brand` | attribute `brand` | string | Yes | Global attribute |
| `primary_category_path` | `Product.primaryCategoryId` | string | Yes | e.g. `/apparel/mens/shirts` |

### Optional core columns

| Column | Maps to | Type | Notes |
|--------|---------|------|-------|
| `status` | `Product.status` | enum | Default `DRAFT`; import cannot set `PUBLISHED` |
| `gtin` | attribute `gtin` | string | |
| `secondary_category_paths` | `ProductCategory` | string | Pipe-separated paths |

### Attribute columns (category-specific)

Prefix attribute columns with `attr:` in header or use bare key matching attribute definition.

| Column | Maps to | Example |
|--------|---------|---------|
| `attr:color` | attribute `color` | `Blue` |
| `attr:size` | attribute `size` | `M` |
| `attr:fabric` | attribute `fabric` | `Cotton` |

---

## Example CSV

```csv
sku,product_type,parent_sku,title,description,brand,primary_category_path,attr:color,attr:size
SHIRT-001,PARENT,,Classic Oxford Shirt,Long sleeve oxford shirt,Acme,/apparel/mens/shirts,,
SHIRT-001-BL-M,VARIANT,SHIRT-001,Classic Oxford Shirt,Long sleeve oxford shirt,Acme,/apparel/mens/shirts,Blue,M
SHIRT-001-BL-L,VARIANT,SHIRT-001,Classic Oxford Shirt,Long sleeve oxford shirt,Acme,/apparel/mens/shirts,Blue,L
MOUSE-001,SIMPLE,,Wireless Mouse,Ergonomic wireless mouse,Acme,/electronics/accessories,,
```

---

## Validation (before commit)

| Check | Severity | When |
|-------|----------|------|
| SKU present and unique in file | Blocking | Dry-run |
| SKU format valid | Blocking | Dry-run |
| `product_type` valid enum | Blocking | Dry-run |
| VARIANT has valid `parent_sku` | Blocking | Dry-run |
| `primary_category_path` exists | Blocking | Dry-run |
| Required attributes for category | Blocking | Dry-run |
| Attribute type matches definition | Blocking | Dry-run |
| Duplicate variant axis combo under parent | Blocking | Dry-run |
| GTIN regex | Warning | Dry-run |

---

## Import Job Behavior

| Setting | MVP default |
|---------|-------------|
| Upsert key | `sku` |
| Partial success | Yes — skip bad rows, commit valid rows |
| Update existing | Yes — patch fields present in CSV |
| Create missing | Yes |
| Default status on create | `DRAFT` |
| Trigger re-validation | Yes — async after commit |

---

## API Equivalence

`POST /v1/products/bulk` accepts JSON array with same field names for programmatic import.

---

## Workshop Decisions (fill in decision-log)

| Question | Decision |
|----------|----------|
| D33 Primary import method | CSV |
| D34 Upsert key | SKU |
| D35 Partial import | _TBD_ |
| D36 Sample file attached | _TBD_ |
