# Phase 2 — Taxonomy and Facet Spec Alignment

Phase 2 is **implemented** on top of Phase 1 Product Core. Search indexing, imports,
workflow, and publishing are separate phases.

## Stack (unchanged from Phase 1)

Fastify · Prisma · Zod · `packages/domain` · `packages/validation` · `packages/facet-engine`

## Schema mapping (ASSUMPTION CHANGEs)

| Brief table / field | Implementation | Notes |
|---------------------|----------------|-------|
| `category_paths` closure table | `Category.path` + `Category.depth` | **ASSUMPTION CHANGE:** materialized path for fast queries (e.g. `/apparel/mens/shirts`) |
| `attributes` | `AttributeDefinition` | Tenant-scoped; `key` = machine code |
| `attribute_group_attributes` join | `AttributeDefinition.attributeGroupId` | **ASSUMPTION CHANGE:** direct FK instead of join table |
| `category_attribute_groups` | `CategoryAttributeGroup` | Join with `sortOrder` |
| Category attribute set | `CategoryAttributeSet` + `CategoryAttributeBinding` | **ASSUMPTION CHANGE:** per-category bindings with requirement/inherit flags |
| `attribute_options` | `AttributeEnumValue` | Controlled-list values for ENUM attributes |
| `facet_definitions.scope` `global\|category` | `FacetScope` `GLOBAL\|CATEGORY` | Category scope when `categoryId` is set |
| `facet_rules.rule_type` | `FacetRuleType` | `DIRECT`, `NORMALIZE`, `RANGE_BUCKET`, `COMPOSITE` (engine supports DIRECT + RANGE_BUCKET) |
| `facet_rules.rule_config_json` | `FacetRule.ruleConfig` (JSON) | |
| Facet-side option copies | `FacetValue` | Synced from enum values on facet create |

Module: `apps/api/src/modules/taxonomy/` (`taxonomy.service.ts`, `facet.service.ts`)

Facet resolution: `packages/facet-engine` → `resolveCategoryFacets()`

## Domain types (`packages/domain`)

| Brief type | Export |
|------------|--------|
| Category | `CategoryEntity` |
| CategoryTreeNode | `CategoryTreeNode` |
| AttributeGroup | `AttributeGroupEntity` |
| CategoryAttributeGroup | Represented via `listAttributeGroupsForCategory()` → `AttributeGroupEntity[]` |
| FacetDefinition | `FacetDefinitionEntity` |
| FacetRule | `FacetRuleEntity` |
| AttributeOption | `AttributeEnumValue` in schema; options returned on `CategoryFacetEntity` |
| Resolved category facets | `CategoryFacetEntity` |

## Validation (`packages/validation`)

| Brief schema | Zod export |
|--------------|------------|
| CreateCategoryInput | `CreateCategorySchema` |
| UpdateCategoryInput | `UpdateCategorySchema` |
| CreateAttributeGroupInput | `CreateAttributeGroupSchema` |
| AttachAttributesToGroupInput | `CreateAttributeSchema` (attribute created in group) |
| AttachAttributeGroupToCategoryInput | `LinkCategoryAttributeGroupsSchema` |
| CreateFacetDefinitionInput | `CreateFacetDefinitionSchema` |
| CreateFacetRuleInput | `CreateFacetRuleSchema` |
| Link attributes to category set | `LinkCategoryAttributesSchema` |

## API endpoints

Base: `/api/v1` · Header: `X-Organization-Slug: demo`

**ASSUMPTION CHANGE:** routes use flat `/api/v1/*` instead of `/taxonomy/*` and `/facets/*` prefixes.
Alias added for spec facet path: `GET /facets/categories/:categoryId`.

### Categories

| Brief | Implemented |
|-------|-------------|
| POST /taxonomy/categories | `POST /categories` |
| GET /taxonomy/categories | `GET /categories` |
| GET /taxonomy/categories/tree | `GET /categories/tree` |
| PATCH /taxonomy/categories/:id | `PATCH /categories/:id` |
| POST …/attribute-groups | `POST /categories/:id/attribute-groups` |
| GET …/attribute-groups | `GET /categories/:id/attribute-groups` |
| GET …/attributes (flattened) | `GET /categories/:id/attributes` |
| POST …/attributes | `POST /categories/:id/attributes` (category attribute set bindings) |
| — | `GET /categories/:id/facets` |

### Attribute groups

| Brief | Implemented |
|-------|-------------|
| POST /taxonomy/attribute-groups | `POST /attribute-groups` |
| GET /taxonomy/attribute-groups | `GET /attribute-groups` |
| GET …/:id/attributes | `GET /attribute-groups/:id/attributes` |
| POST …/:id/attributes | `POST /attributes` with `attributeGroupId` |

### Facets

| Brief | Implemented |
|-------|-------------|
| POST /facets/definitions | `POST /facet-definitions` |
| GET /facets/definitions | `GET /facet-definitions` |
| POST /facets/rules | `POST /facet-rules` |
| GET /facets/rules | `GET /facet-rules` |
| GET /facets/categories/:categoryId | `GET /facets/categories/:categoryId` (alias) + `GET /categories/:id/facets` |

### `getFacetsForCategory`

Implemented as **`getCategoryFacets(categoryId, organizationId)`** in `facet.service.ts`:

1. Load GLOBAL + category-scoped `FacetDefinition` rows for the category.
2. Load associated `FacetRule`, `FacetValue`, and `AttributeEnumValue` data.
3. Resolve via `facet-engine` (priority-ordered rules, controlled options).

## Category tree

`getCategoryTree()` — Option A from spec: in-memory tree from `parentId`, sorted by `sortOrder` + `name`.

## Tests

```bash
pnpm --filter @productinfoman/api test -- src/__tests__/taxonomy-facet.test.ts
pnpm --filter @productinfoman/facet-engine test
```

## Deliverables checklist

- [x] Category tree CRUD (create, list, tree, update)
- [x] Attribute groups + attributes
- [x] Categories linked to attribute groups
- [x] Category attribute set bindings
- [x] Facet definitions and rules
- [x] Facets for category endpoint
- [x] Tests for taxonomy + facet behaviors

## Out of scope (later phases)

Search indexing, imports, approvals, publishing — implemented in Phases 3–7.

## Known gaps (non-blocking for Phase 2 MVP)

- No `category_paths` closure table (materialized `path` used instead)
- Facet/attribute update & delete endpoints
- `GET /products/:id/facets` (per-product computed facets — search phase)
- Category facet inheritance up the tree (MVP: category-scoped + global only)
