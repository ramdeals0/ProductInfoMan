# Discovery Workshop & Questionnaire

Use this document in Phase 0 discovery sessions with merchandising, ecommerce ops, engineering, and governance stakeholders. Capture answers before sprint 1.

---

## Session 1 — Business Context & Source of Truth

### Products & Systems

1. **What is the source of truth for products today?** (ERP, spreadsheets, ecommerce platform, legacy PIM, multiple)
2. **What is the target source of truth after PIM launch?**
3. **Which systems must PIM integrate with in year 1?** (Shopify, Magento, NetSuite, WMS, DAM)
4. **Who owns product data quality today?** (role/team)
5. **What pain points drive this project?** (duplication, slow launch, inconsistent facets, etc.)

### Product Types

6. **What product types exist in your catalog?**
   - [ ] Simple (single SKU)
   - [ ] Parent with variants (size/color)
   - [ ] Bundles/kits
   - [ ] Collections (non-sellable groupings)
   - [ ] Digital goods
   - [ ] Services
   - [ ] Other: ___________

7. **What percentage of catalog is each type?**
8. **Are parent products sellable, or only children?**
9. **Do you sell the same SKU across multiple brands or stores?**

### Scale

10. **Current SKU count?** Projected in 12 / 24 months?
11. **How many new SKUs per week/month?**
12. **How many concurrent catalog editors?**
13. **How many ecommerce channels today?** Future?

---

## Session 2 — Taxonomy & Attributes

### Taxonomy

14. **Do you have an existing category tree?** Can you export it?
15. **Maximum category depth?**
16. **Can a product belong to multiple categories?** Primary vs secondary rules?
17. **Do categories differ by brand or region?**
18. **Do you use external taxonomies?** (Google Product Category, UNSPSC)

### Attributes

19. **List your global attributes** (apply to all products): ___________
20. **List category-specific attribute examples** (e.g., Apparel: fabric, fit):
21. **What attribute data types are needed?** (text, number, enum, boolean, rich text, media)
22. **Who defines new attributes?** Approval required?
23. **Are there regulated attributes?** (nutrition, hazmat, compliance claims)
24. **Do attributes vary by sales channel?**

### Attribute Groups

25. **How should attributes be grouped in the UI?** (Marketing, Specifications, Logistics, SEO)
26. **Are there attributes only visible to internal users?**

---

## Session 3 — Variants & Inheritance

27. **What defines a parent vs child product in your business?**
28. **What are your standard variant axes?** (Color, Size, Material, Capacity)
29. **Are variant axes consistent across all categories or category-specific?**
30. **Which parent fields should children inherit?**
    - [ ] Title
    - [ ] Description
    - [ ] Images
    - [ ] Brand
    - [ ] Specifications
    - [ ] SEO metadata
    - [ ] Other: ___________
31. **Which fields must always be unique per child?**
32. **Can a child override inherited images?** All or swatch only?
33. **How are variant SKUs generated?** (convention, manual, auto-matrix)
34. **Are invalid variant combinations blocked?** (e.g., XL + Pink not offered)

---

## Session 4 — Facets & Navigation

35. **How are browse facets managed today?**
36. **Which facets are derived from attributes vs manually maintained?**
37. **List top 10 facets for your primary category:** ___________
38. **Do facet values need normalization?** (e.g., "Navy" / "Navy Blue" → "Blue")
39. **Are facets category-specific or global?**
40. **Facet sort order rules?** (alphabetical, count, manual)
41. **Do facets differ per sales channel?**

---

## Session 5 — Validation & Publishing

### Validation

42. **What validation rules block publishing today?**
43. **Required fields per category — can you provide a matrix?**
44. **Are warnings acceptable on publish, or zero-warning policy?**
45. **Channel-specific required fields?** (Shopify vs Amazon)
46. **Image requirements?** (min count, dimensions, alt text)
47. **Legal/compliance gates?**

### Publishing

48. **What does "published" mean?** (live on site, export file, API available)
49. **Push vs pull model?** (PIM pushes to channel vs channel polls PIM)
50. **Publish frequency?** (real-time, scheduled, batch nightly)
51. **Can a product be published to one channel but not another?**
52. **Rollback requirements?**
53. **Must parent publish before children?**

---

## Session 6 — Workflow & Governance

54. **Who can create products?**
55. **Who can edit products?**
56. **Who can approve products?**
57. **Who can publish products?**
58. **Is approval required for all changes or only first publish?**
59. **Single-step or multi-level approval?**
60. **SLA for review turnaround?**
61. **Audit/compliance retention period for changes?**
62. **Category-scoped permissions needed?** (e.g., vendor edits only their categories)

---

## Session 7 — Import / Export

63. **Primary onboarding method?** (CSV, API, ERP sync, manual UI)
64. **CSV format examples available?**
65. **Upsert key?** (SKU, GTIN, external ID)
66. **How are import errors handled?** (all-or-nothing vs partial)
67. **Import frequency?** (one-time migration, daily sync)
68. **Export destinations and formats for MVP?**
69. **Delta vs full export?**

---

## Session 8 — Technical & Future

70. **Single tenant or multi-tenant SaaS?**
71. **SSO required for MVP?**
72. **Localization / multi-language content?** Which locales?
73. **AI enrichment interest?** (descriptions, attribute fill, image alt text)
74. **DAM in use?** Which provider?
75. **Performance SLAs?**
76. **MVP launch date target?**
77. **What is explicitly OUT of MVP?**

---

## Decision Log Template

| Question # | Decision | Owner | Date | Notes |
|------------|----------|-------|------|-------|
| 1 | | | | |
| 27 | | | | |
| 48 | | | | |
| 76 | | | | |

---

## MVP Boundary Checklist

Use answers to finalize MVP scope:

| Capability | MVP? | Notes |
|------------|------|-------|
| Simple products | | |
| Parent-child variants | | |
| Bundles | | |
| Collections | | |
| CSV import | | |
| API import | | |
| Single approval step | | |
| Channel export | | |
| Basic facets | | |
| Facet normalization | | |
| DAM integration | | |
| AI enrichment | | |
| Multi-language | | |
| SSO | | |

---

## Critical Questions (Must Answer Before Development)

These map directly to architecture decisions:

| # | Question | Impacts |
|---|----------|---------|
| Q1 | What is the source of truth for products? | Integration design, conflict resolution |
| Q2 | What product types exist? | Domain model, MVP scope |
| Q3 | What attributes are global vs category-specific? | Attribute schema, validation |
| Q4 | What defines a parent vs child product? | Variant model |
| Q5 | How are variants inherited and overridden? | Inheritance engine |
| Q6 | How are facets generated? | Facet rule engine scope |
| Q7 | What validation blocks publishing? | Validation rules MVP |
| Q8 | Which channels require export? | E11 priority |
| Q9 | Who can create, edit, approve, and publish? | RBAC matrix |
| Q10 | What is the MVP boundary? | Sprint planning |
