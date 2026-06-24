import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  DEMO_ATTRIBUTE_DEFINITIONS,
  DEMO_FACET_DEFINITIONS,
  type AttributeSeedDefinition,
} from "../fleetfarm/facets.js";
import { FLEETFARM_CATEGORIES } from "../fleetfarm/config.js";
import type { ScrapedProduct } from "../fleetfarm/types.js";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function seedDemoCategories(prisma: PrismaClient, organizationId: string) {
  const categoryByCode = new Map<string, string>();

  const root = await prisma.category.upsert({
    where: { organizationId_code: { organizationId, code: "fleetfarm-demo" } },
    create: {
      organizationId,
      code: "fleetfarm-demo",
      name: "Fleet Farm Demo",
      slug: "fleetfarm-demo",
      path: "/fleetfarm-demo",
      depth: 0,
      sortOrder: 0,
    },
    update: { isActive: true, status: "ACTIVE" },
  });
  categoryByCode.set(root.code, root.id);

  for (const [index, category] of FLEETFARM_CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { organizationId_code: { organizationId, code: category.code } },
      create: {
        organizationId,
        parentId: root.id,
        code: category.code,
        name: category.name,
        slug: slugify(category.code),
        path: `/fleetfarm-demo/${category.code}`,
        depth: 1,
        sortOrder: index,
      },
      update: {
        parentId: root.id,
        name: category.name,
        isActive: true,
        status: "ACTIVE",
      },
    });
    categoryByCode.set(category.code, row.id);
  }

  return categoryByCode;
}

export async function seedDemoAttributesAndFacets(
  prisma: PrismaClient,
  organizationId: string,
  categoryByCode: Map<string, string>,
) {
  const groups = {
    general: await prisma.attributeGroup.upsert({
      where: { organizationId_code: { organizationId, code: "general" } },
      create: { organizationId, code: "general", name: "General", sortOrder: 0 },
      update: {},
    }),
    specs: await prisma.attributeGroup.upsert({
      where: { organizationId_code: { organizationId, code: "specs" } },
      create: { organizationId, code: "specs", name: "Specifications", sortOrder: 1 },
      update: {},
    }),
    fit: await prisma.attributeGroup.upsert({
      where: { organizationId_code: { organizationId, code: "fit" } },
      create: { organizationId, code: "fit", name: "Fit", sortOrder: 2 },
      update: {},
    }),
  };

  const attrByKey = new Map<string, { id: string; key: string }>();

  for (const def of DEMO_ATTRIBUTE_DEFINITIONS) {
    const row = await prisma.attributeDefinition.upsert({
      where: { organizationId_key: { organizationId, key: def.key } },
      create: {
        organizationId,
        attributeGroupId: groups[def.groupCode].id,
        key: def.key,
        label: def.label,
        dataType: def.dataType,
        isGlobal: def.isGlobal ?? false,
        isFilterable: def.isFilterable ?? false,
        isSearchable: def.isSearchable ?? false,
        allowedValuesType: def.allowedValues?.length ? "CONTROLLED_LIST" : "FREE_TEXT",
      },
      update: {
        label: def.label,
        isGlobal: def.isGlobal ?? false,
        isFilterable: def.isFilterable ?? false,
        isSearchable: def.isSearchable ?? false,
        allowedValuesType: def.allowedValues?.length ? "CONTROLLED_LIST" : "FREE_TEXT",
      },
    });
    attrByKey.set(def.key, row);

    if (def.allowedValues?.length) {
      for (let i = 0; i < def.allowedValues.length; i++) {
        const value = def.allowedValues[i]!;
        await prisma.attributeEnumValue.upsert({
          where: {
            attributeDefinitionId_value: {
              attributeDefinitionId: row.id,
              value,
            },
          },
          create: {
            attributeDefinitionId: row.id,
            value,
            label: value,
            sortOrder: i,
          },
          update: { label: value, sortOrder: i },
        });
      }
    }
  }

  for (const def of DEMO_ATTRIBUTE_DEFINITIONS) {
    const attr = attrByKey.get(def.key);
    if (!attr || !def.categoryCodes?.length) continue;

    for (const categoryCode of def.categoryCodes) {
      const categoryId = categoryByCode.get(categoryCode);
      if (!categoryId) continue;

      const attrSet = await prisma.categoryAttributeSet.upsert({
        where: { categoryId },
        create: { categoryId },
        update: {},
      });

      await prisma.categoryAttributeBinding.upsert({
        where: {
          categoryAttributeSetId_attributeDefinitionId: {
            categoryAttributeSetId: attrSet.id,
            attributeDefinitionId: attr.id,
          },
        },
        create: {
          categoryAttributeSetId: attrSet.id,
          attributeDefinitionId: attr.id,
          requirement: "OPTIONAL",
          inheritFromParent: false,
        },
        update: {},
      });

      const groupId = groups[(DEMO_ATTRIBUTE_DEFINITIONS.find((entry) => entry.key === def.key) as AttributeSeedDefinition).groupCode].id;
      await prisma.categoryAttributeGroup.upsert({
        where: {
          categoryId_attributeGroupId: {
            categoryId,
            attributeGroupId: groupId,
          },
        },
        create: { categoryId, attributeGroupId: groupId, sortOrder: 0 },
        update: {},
      });
    }
  }

  for (const facet of DEMO_FACET_DEFINITIONS) {
    const sourceAttr = attrByKey.get(facet.sourceAttributeCode);
    if (!sourceAttr) continue;

    const categoryId =
      facet.scope === "category" && facet.categoryCode
        ? categoryByCode.get(facet.categoryCode) ?? null
        : null;

    const facetRow = await prisma.facetDefinition.upsert({
      where: { organizationId_key: { organizationId, key: facet.code } },
      create: {
        organizationId,
        key: facet.code,
        label: facet.name,
        sourceAttributeId: sourceAttr.id,
        categoryId,
        scope: facet.scope === "global" ? "GLOBAL" : "CATEGORY",
        sortOrder: facet.sortOrder,
        isDynamic: true,
      },
      update: {
        label: facet.name,
        sourceAttributeId: sourceAttr.id,
        categoryId,
        scope: facet.scope === "global" ? "GLOBAL" : "CATEGORY",
        sortOrder: facet.sortOrder,
        isActive: true,
      },
    });

    const enumValues = await prisma.attributeEnumValue.findMany({
      where: { attributeDefinitionId: sourceAttr.id },
    });
    for (const enumValue of enumValues) {
      await prisma.facetValue.upsert({
        where: {
          facetDefinitionId_value: {
            facetDefinitionId: facetRow.id,
            value: enumValue.value,
          },
        },
        create: {
          facetDefinitionId: facetRow.id,
          value: enumValue.value,
          label: enumValue.label,
          sortOrder: enumValue.sortOrder,
          sourceEnumValueId: enumValue.id,
        },
        update: {
          label: enumValue.label,
          sortOrder: enumValue.sortOrder,
          sourceEnumValueId: enumValue.id,
        },
      });
    }

    const existingRule = await prisma.facetRule.findFirst({
      where: {
        facetDefinitionId: facetRow.id,
        categoryId: categoryId ?? null,
      },
    });
    if (!existingRule) {
      await prisma.facetRule.create({
        data: {
          organizationId,
          categoryId,
          attributeDefinitionId: sourceAttr.id,
          facetDefinitionId: facetRow.id,
          ruleType: facet.ruleType ?? "DIRECT",
        },
      });
    }
  }

  return attrByKey;
}

export async function seedScrapedProducts(
  prisma: PrismaClient,
  organizationId: string,
  products: ScrapedProduct[],
  categoryByCode: Map<string, string>,
  attrByKey: Map<string, { id: string; key: string }>,
) {
  let created = 0;
  let updated = 0;

  for (const scraped of products) {
    const sku = `FF-${scraped.externalId.toUpperCase()}`;
    const categoryId = categoryByCode.get(scraped.categoryCode);
    if (!categoryId) continue;

    const existing = await prisma.product.findUnique({
      where: { organizationId_sku: { organizationId, sku } },
    });

    const product = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId, sku } },
      create: {
        organizationId,
        productType: "SIMPLE",
        sku,
        title: scraped.title,
        description: scraped.description ?? `${scraped.title} — demo catalog item`,
        brand: scraped.brand ?? (typeof scraped.attributes.brand === "string" ? scraped.attributes.brand : null),
        primaryCategoryId: categoryId,
        status: "PUBLISHED",
      },
      update: {
        title: scraped.title,
        description: scraped.description ?? undefined,
        brand: scraped.brand ?? (typeof scraped.attributes.brand === "string" ? scraped.attributes.brand : undefined),
        primaryCategoryId: categoryId,
        status: "PUBLISHED",
      },
    });

    if (existing) updated++;
    else created++;

    for (const [key, value] of Object.entries(scraped.attributes)) {
      if (key === "brand") continue;
      const attr = attrByKey.get(key);
      if (!attr || value == null) continue;

      await prisma.productAttributeValue.upsert({
        where: {
          productId_attributeDefinitionId: {
            productId: product.id,
            attributeDefinitionId: attr.id,
          },
        },
        create: {
          productId: product.id,
          attributeDefinitionId: attr.id,
          value: value as never,
          source: "LOCAL",
        },
        update: { value: value as never },
      });
    }

    await prisma.productSystemId.upsert({
      where: {
        organizationId_systemCode_externalKey: {
          organizationId,
          systemCode: "FLEETFARM",
          externalKey: scraped.externalId,
        },
      },
      create: {
        organizationId,
        productId: product.id,
        systemCode: "FLEETFARM",
        externalKey: scraped.externalId,
        isPrimary: true,
      },
      update: { productId: product.id },
    });
  }

  return { created, updated, total: products.length };
}
