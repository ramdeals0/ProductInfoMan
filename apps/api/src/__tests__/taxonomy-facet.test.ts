import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createCategory,
  createAttributeGroup,
  createAttribute,
  getCategoryTree,
  linkCategoryAttributeGroups,
  listAttributeGroupsForCategory,
  listAttributesForCategory,
  listAttributesForGroup,
} from "../modules/taxonomy/taxonomy.service.js";
import {
  createFacetDefinition,
  createFacetRule,
  getCategoryFacets,
  listFacetRules,
} from "../modules/taxonomy/facet.service.js";
import { prisma } from "@productinfoman/db";

const ORG_SLUG = "demo";
let organizationId: string;

beforeAll(async () => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Taxonomy and Facets", () => {
  // Phase 2 spec §8: Creating a category with unique code.
  it("creates a category with unique code", async () => {
    const ts = Date.now();
    const category = await createCategory(organizationId, {
      name: "Footwear",
      code: `footwear-${ts}`,
      slug: `footwear-${ts}`,
    });
    expect(category.code).toBe(`footwear-${ts}`);
    expect(category.path).toBe(`/${category.slug}`);
  });

  // Phase 2 spec §8: Rejecting duplicate category code.
  it("rejects duplicate category code", async () => {
    const ts = Date.now();
    const code = `dup-cat-${ts}`;
    await createCategory(organizationId, {
      name: "First",
      code,
      slug: `first-${ts}`,
    });
    await expect(
      createCategory(organizationId, {
        name: "Second",
        code,
        slug: `second-${ts}`,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  // Phase 2 spec §8: Building a simple category tree.
  it("builds a simple category tree", async () => {
    const ts = Date.now();
    const root = await createCategory(organizationId, {
      name: "Apparel",
      code: `apparel-tree-${ts}`,
      slug: `apparel-tree-${ts}`,
    });
    const child = await createCategory(organizationId, {
      name: "Shirts",
      code: `shirts-tree-${ts}`,
      slug: `shirts-tree-${ts}`,
      parentId: root.id,
    });

    const tree = await getCategoryTree(organizationId);
    const rootNode = tree.find((node) => node.id === root.id);
    expect(rootNode?.children.some((c) => c.id === child.id)).toBe(true);
    expect(child.path).toBe(`${root.path}/${child.slug}`);
  });

  // Phase 2 spec §8: Creating attribute groups and attaching attributes.
  it("creates attribute groups and lists group attributes", async () => {
    const ts = Date.now();
    const group = await createAttributeGroup(organizationId, {
      name: `Dimensions ${ts}`,
      code: `dimensions-${ts}`,
    });

    const weight = await createAttribute(organizationId, {
      attributeGroupId: group.id,
      key: `weight_${ts}`,
      label: "Weight",
      dataType: "NUMBER",
    });

    const attrs = await listAttributesForGroup(group.id, organizationId);
    expect(attrs.map((a) => a.id)).toContain(weight.id);
  });

  // Phase 2 spec §8: Attaching attribute groups to category and listing category attributes.
  it("links attribute groups to a category and lists flattened attributes", async () => {
    const ts = Date.now();
    const category = await createCategory(organizationId, {
      name: "Jackets",
      code: `jackets-${ts}`,
      slug: `jackets-${ts}`,
    });

    const group = await createAttributeGroup(organizationId, {
      name: `Specs ${ts}`,
      code: `specs-cat-${ts}`,
    });

    await createAttribute(organizationId, {
      attributeGroupId: group.id,
      key: `material_${ts}`,
      label: "Material",
      dataType: "TEXT",
    });

    await linkCategoryAttributeGroups(category.id, organizationId, {
      attributeGroupIds: [group.id],
    });

    const groups = await listAttributeGroupsForCategory(category.id, organizationId);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.code).toBe(`specs-cat-${ts}`);

    const attrs = await listAttributesForCategory(category.id, organizationId);
    expect(attrs.some((a) => a.key === `material_${ts}`)).toBe(true);
  });

  // Phase 2 spec §8: Creating facet definitions and facet rules.
  it("creates facet definitions and rules", async () => {
    const ts = Date.now();
    const category = await createCategory(organizationId, {
      name: "Pants",
      code: `pants-${ts}`,
      slug: `pants-${ts}`,
    });

    const group = await createAttributeGroup(organizationId, {
      name: `Filter Specs ${ts}`,
      code: `filter-specs-${ts}`,
    });

    const colorAttr = await createAttribute(organizationId, {
      attributeGroupId: group.id,
      key: `facet_color_${ts}`,
      label: "Color",
      dataType: "ENUM",
      isFilterable: true,
      allowedValuesType: "CONTROLLED_LIST",
    });

    const sizeAttr = await createAttribute(organizationId, {
      attributeGroupId: group.id,
      key: `facet_size_${ts}`,
      label: "Size",
      dataType: "ENUM",
      isFilterable: true,
      allowedValuesType: "CONTROLLED_LIST",
    });

    await prisma.attributeEnumValue.create({
      data: {
        attributeDefinitionId: colorAttr.id,
        value: "navy",
        label: "Navy",
        sortOrder: 0,
      },
    });

    const facet = await createFacetDefinition(organizationId, {
      key: `facet_color_${ts}`,
      label: "Color",
      sourceAttributeId: colorAttr.id,
      categoryId: category.id,
      sortOrder: 1,
    });

    await createFacetRule(organizationId, {
      facetDefinitionId: facet.id,
      categoryId: category.id,
      attributeDefinitionId: colorAttr.id,
      ruleType: "DIRECT",
    });

    await expect(
      createFacetRule(organizationId, {
        facetDefinitionId: facet.id,
        categoryId: category.id,
        attributeDefinitionId: sizeAttr.id,
        ruleType: "DIRECT",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    const rules = await listFacetRules(organizationId, { categoryId: category.id });
    expect(rules.length).toBeGreaterThanOrEqual(1);
  });

  // Phase 2 spec §8: Retrieving facets for a category.
  it("retrieves resolved facets for a category", async () => {
    const ts = Date.now();
    const category = await createCategory(organizationId, {
      name: "Shorts",
      code: `shorts-${ts}`,
      slug: `shorts-${ts}`,
    });

    const group = await createAttributeGroup(organizationId, {
      name: `Shorts Specs ${ts}`,
      code: `shorts-specs-${ts}`,
    });

    const sizeAttr = await createAttribute(organizationId, {
      attributeGroupId: group.id,
      key: `shorts_size_${ts}`,
      label: "Size",
      dataType: "ENUM",
      isFilterable: true,
      allowedValuesType: "CONTROLLED_LIST",
    });

    await prisma.attributeEnumValue.createMany({
      data: [
        {
          attributeDefinitionId: sizeAttr.id,
          value: "S",
          label: "Small",
          sortOrder: 0,
        },
        {
          attributeDefinitionId: sizeAttr.id,
          value: "M",
          label: "Medium",
          sortOrder: 1,
        },
      ],
    });

    const sizeFacet = await createFacetDefinition(organizationId, {
      key: `shorts_size_facet_${ts}`,
      label: "Size",
      sourceAttributeId: sizeAttr.id,
      categoryId: category.id,
      sortOrder: 1,
    });

    await createFacetRule(organizationId, {
      facetDefinitionId: sizeFacet.id,
      categoryId: category.id,
      attributeDefinitionId: sizeAttr.id,
      ruleType: "DIRECT",
    });

    const facets = await getCategoryFacets(category.id, organizationId);
    const sizeFacetResult = facets.find((f) => f.key === `shorts_size_facet_${ts}`);
    expect(sizeFacetResult?.options).toEqual([
      { value: "S", label: "Small", sortOrder: 0 },
      { value: "M", label: "Medium", sortOrder: 1 },
    ]);
  });
});
