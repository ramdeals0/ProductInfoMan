import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createCategory,
  createAttributeGroup,
  createAttribute,
  getCategoryTree,
  linkCategoryAttributeGroups,
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
  it("builds category tree, rejects duplicate codes, and resolves facet metadata", async () => {
    const ts = Date.now();

    const apparel = await createCategory(organizationId, {
      name: "Apparel",
      code: `apparel-${ts}`,
      slug: `apparel-${ts}`,
    });

    const shirts = await createCategory(organizationId, {
      name: "Shirts",
      code: `shirts-${ts}`,
      slug: `shirts-${ts}`,
      parentId: apparel.id,
    });

    await expect(
      createCategory(organizationId, {
        name: "Duplicate Apparel",
        code: `apparel-${ts}`,
        slug: `apparel-dup-${ts}`,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const tree = await getCategoryTree(organizationId);
    const apparelNode = tree.find((node) => node.id === apparel.id);
    expect(apparelNode?.children.some((child) => child.id === shirts.id)).toBe(true);

    const specsGroup = await createAttributeGroup(organizationId, {
      name: `Specifications ${ts}`,
      code: `specs-${ts}`,
    });

    await linkCategoryAttributeGroups(shirts.id, organizationId, {
      attributeGroupIds: [specsGroup.id],
    });

    const colorAttr = await createAttribute(organizationId, {
      attributeGroupId: specsGroup.id,
      key: `color_${ts}`,
      label: "Color",
      dataType: "ENUM",
      isFilterable: true,
      isSearchable: true,
      allowedValuesType: "CONTROLLED_LIST",
    });

    await prisma.attributeEnumValue.createMany({
      data: [
        {
          attributeDefinitionId: colorAttr.id,
          value: "blue",
          label: "Blue",
          sortOrder: 0,
        },
        {
          attributeDefinitionId: colorAttr.id,
          value: "white",
          label: "White",
          sortOrder: 1,
        },
      ],
    });

    const sizeAttr = await createAttribute(organizationId, {
      attributeGroupId: specsGroup.id,
      key: `size_${ts}`,
      label: "Size",
      dataType: "ENUM",
      isFilterable: true,
      allowedValuesType: "CONTROLLED_LIST",
    });

    await prisma.attributeEnumValue.createMany({
      data: [
        {
          attributeDefinitionId: sizeAttr.id,
          value: "M",
          label: "Medium",
          sortOrder: 0,
        },
        {
          attributeDefinitionId: sizeAttr.id,
          value: "L",
          label: "Large",
          sortOrder: 1,
        },
      ],
    });

    const colorFacet = await createFacetDefinition(organizationId, {
      key: `color_${ts}`,
      label: "Color",
      sourceAttributeId: colorAttr.id,
      categoryId: shirts.id,
      sortOrder: 1,
    });

    const sizeFacet = await createFacetDefinition(organizationId, {
      key: `size_${ts}`,
      label: "Size",
      sourceAttributeId: sizeAttr.id,
      categoryId: shirts.id,
      sortOrder: 2,
    });

    await createFacetRule(organizationId, {
      facetDefinitionId: colorFacet.id,
      categoryId: shirts.id,
      attributeDefinitionId: colorAttr.id,
      ruleType: "DIRECT",
    });

    await createFacetRule(organizationId, {
      facetDefinitionId: sizeFacet.id,
      categoryId: shirts.id,
      attributeDefinitionId: sizeAttr.id,
      ruleType: "DIRECT",
    });

    await expect(
      createFacetRule(organizationId, {
        facetDefinitionId: colorFacet.id,
        categoryId: shirts.id,
        attributeDefinitionId: sizeAttr.id,
        ruleType: "DIRECT",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    const rules = await listFacetRules(organizationId, { categoryId: shirts.id });
    expect(rules.length).toBeGreaterThanOrEqual(2);

    const facets = await getCategoryFacets(shirts.id, organizationId);
    expect(facets.map((facet) => facet.key)).toEqual([`color_${ts}`, `size_${ts}`]);
    expect(facets[0]?.options).toEqual([
      { value: "blue", label: "Blue", sortOrder: 0 },
      { value: "white", label: "White", sortOrder: 1 },
    ]);
    expect(facets[1]?.options[0]).toEqual({
      value: "M",
      label: "Medium",
      sortOrder: 0,
    });
  });
});
