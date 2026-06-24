import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AttributeDataType, FacetRuleType } from "../../generated/prisma/client.js";
import {
  attributeSeeds,
  facetDefinitionSeeds,
  facetRuleSeeds,
  DEMO_CATEGORY_SEEDS,
  type AttributeDataTypeSeed,
  type AttributeSeed,
} from "../../packages/config/facets.config.js";

export type SeedStats = {
  attributesCreated: number;
  attributesUpdated: number;
  facetDefinitionsCreated: number;
  facetDefinitionsUpdated: number;
  facetRulesCreated: number;
  facetRulesUpdated: number;
  categoriesEnsured: number;
  attrByKey: Map<string, { id: string; key: string }>;
};

const GROUP_DEFAULTS = {
  general: { code: "general", name: "General", sortOrder: 0 },
  specs: { code: "specs", name: "Specifications", sortOrder: 1 },
  fit: { code: "fit", name: "Fit", sortOrder: 2 },
} as const;

function mapDataType(dataType: AttributeDataTypeSeed): AttributeDataType {
  switch (dataType) {
    case "string":
      return "TEXT";
    case "text":
      return "RICH_TEXT";
    case "integer":
    case "decimal":
      return "NUMBER";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "DATE";
    case "enum":
      return "ENUM";
    default:
      return "TEXT";
  }
}

function resolveGroupCode(seed: AttributeSeed): keyof typeof GROUP_DEFAULTS {
  if (seed.groupCode) return seed.groupCode;
  if (["brand", "price", "rating", "availability"].includes(seed.code)) return "general";
  if (["apparel_gender", "apparel_size", "color", "apparel_type"].includes(seed.code)) return "fit";
  return "specs";
}

function mapFacetRuleType(ruleType: FacetRuleSeed["ruleType"]): FacetRuleType {
  switch (ruleType) {
    case "range":
      return "RANGE_BUCKET";
    case "normalize":
      return "NORMALIZE";
    case "include":
    case "exclude":
      return "DIRECT";
    default:
      return "DIRECT";
  }
}

type FacetRuleSeed = (typeof facetRuleSeeds)[number];

export async function ensureDemoCategories(
  prisma: PrismaClient,
  organizationId: string,
): Promise<Map<string, string>> {
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
    },
    update: { isActive: true, status: "ACTIVE" },
  });
  categoryByCode.set(root.code, root.id);

  for (const [index, category] of DEMO_CATEGORY_SEEDS.entries()) {
    const row = await prisma.category.upsert({
      where: { organizationId_code: { organizationId, code: category.code } },
      create: {
        organizationId,
        parentId: root.id,
        code: category.code,
        name: category.name,
        slug: category.code.replace(/_/g, "-"),
        path: `/fleetfarm-demo/${category.code.replace(/_/g, "-")}`,
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

export async function seedAttributesAndFacets(
  prisma: PrismaClient,
  organizationId: string,
): Promise<SeedStats> {
  const stats: SeedStats = {
    attributesCreated: 0,
    attributesUpdated: 0,
    facetDefinitionsCreated: 0,
    facetDefinitionsUpdated: 0,
    facetRulesCreated: 0,
    facetRulesUpdated: 0,
    categoriesEnsured: 0,
    attrByKey: new Map(),
  };

  const categoryByCode = await ensureDemoCategories(prisma, organizationId);
  stats.categoriesEnsured = categoryByCode.size;

  const groups: Record<keyof typeof GROUP_DEFAULTS, { id: string }> = {} as never;
  for (const [key, def] of Object.entries(GROUP_DEFAULTS) as Array<
    [keyof typeof GROUP_DEFAULTS, (typeof GROUP_DEFAULTS)[keyof typeof GROUP_DEFAULTS]]
  >) {
    groups[key] = await prisma.attributeGroup.upsert({
      where: { organizationId_code: { organizationId, code: def.code } },
      create: {
        organizationId,
        code: def.code,
        name: def.name,
        sortOrder: def.sortOrder,
      },
      update: { name: def.name, sortOrder: def.sortOrder },
    });
  }

  const attrByCode = new Map<string, { id: string; created: boolean }>();

  for (const seed of attributeSeeds) {
    const groupCode = resolveGroupCode(seed);
    const existing = await prisma.attributeDefinition.findUnique({
      where: { organizationId_key: { organizationId, key: seed.code } },
    });

    const row = await prisma.attributeDefinition.upsert({
      where: { organizationId_key: { organizationId, key: seed.code } },
      create: {
        organizationId,
        attributeGroupId: groups[groupCode].id,
        key: seed.code,
        label: seed.name,
        dataType: mapDataType(seed.dataType),
        isGlobal: !seed.categoryCodes?.length,
        isVariantAxis: seed.isVariantAttribute ?? false,
        isRequired: seed.isRequired ?? false,
        isFilterable: seed.isFilterable ?? false,
        isSearchable: seed.isSearchable ?? false,
        allowedValuesType: seed.enumValues?.length ? "CONTROLLED_LIST" : "FREE_TEXT",
      },
      update: {
        label: seed.name,
        attributeGroupId: groups[groupCode].id,
        dataType: mapDataType(seed.dataType),
        isGlobal: !seed.categoryCodes?.length,
        isVariantAxis: seed.isVariantAttribute ?? false,
        isRequired: seed.isRequired ?? false,
        isFilterable: seed.isFilterable ?? false,
        isSearchable: seed.isSearchable ?? false,
        allowedValuesType: seed.enumValues?.length ? "CONTROLLED_LIST" : "FREE_TEXT",
      },
    });

    if (existing) stats.attributesUpdated++;
    else stats.attributesCreated++;

    attrByCode.set(seed.code, { id: row.id, created: !existing });
    stats.attrByKey.set(seed.code, { id: row.id, key: seed.code });

    if (seed.enumValues?.length) {
      for (let i = 0; i < seed.enumValues.length; i++) {
        const value = seed.enumValues[i]!;
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

    if (seed.categoryCodes?.length) {
      for (const categoryCode of seed.categoryCodes) {
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
              attributeDefinitionId: row.id,
            },
          },
          create: {
            categoryAttributeSetId: attrSet.id,
            attributeDefinitionId: row.id,
            requirement: seed.isRequired ? "REQUIRED" : "OPTIONAL",
            inheritFromParent: false,
          },
          update: {
            requirement: seed.isRequired ? "REQUIRED" : "OPTIONAL",
          },
        });

        await prisma.categoryAttributeGroup.upsert({
          where: {
            categoryId_attributeGroupId: {
              categoryId,
              attributeGroupId: groups[groupCode].id,
            },
          },
          create: {
            categoryId,
            attributeGroupId: groups[groupCode].id,
            sortOrder: 0,
          },
          update: {},
        });
      }
    }
  }

  const facetByCode = new Map<string, string>();

  for (const seed of facetDefinitionSeeds) {
    const sourceAttr = attrByCode.get(seed.sourceAttributeCode);
    if (!sourceAttr) {
      throw new Error(`Missing source attribute for facet: ${seed.sourceAttributeCode}`);
    }

    const categoryId =
      seed.scope === "category" && seed.categoryCode
        ? (categoryByCode.get(seed.categoryCode) ?? null)
        : null;

    if (seed.scope === "category" && seed.categoryCode && !categoryId) {
      throw new Error(`Missing category for facet ${seed.code}: ${seed.categoryCode}`);
    }

    const existing = await prisma.facetDefinition.findUnique({
      where: { organizationId_key: { organizationId, key: seed.code } },
    });

    const facet = await prisma.facetDefinition.upsert({
      where: { organizationId_key: { organizationId, key: seed.code } },
      create: {
        organizationId,
        key: seed.code,
        label: seed.name,
        sourceAttributeId: sourceAttr.id,
        categoryId,
        scope: seed.scope === "global" ? "GLOBAL" : "CATEGORY",
        sortOrder: seed.displayOrder ?? 0,
        isDynamic: true,
        isActive: true,
      },
      update: {
        label: seed.name,
        sourceAttributeId: sourceAttr.id,
        categoryId,
        scope: seed.scope === "global" ? "GLOBAL" : "CATEGORY",
        sortOrder: seed.displayOrder ?? 0,
        isActive: true,
      },
    });

    if (existing) stats.facetDefinitionsUpdated++;
    else stats.facetDefinitionsCreated++;

    facetByCode.set(seed.code, facet.id);

    const enumValues = await prisma.attributeEnumValue.findMany({
      where: { attributeDefinitionId: sourceAttr.id },
    });
    for (const enumValue of enumValues) {
      await prisma.facetValue.upsert({
        where: {
          facetDefinitionId_value: {
            facetDefinitionId: facet.id,
            value: enumValue.value,
          },
        },
        create: {
          facetDefinitionId: facet.id,
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
  }

  for (const seed of facetRuleSeeds) {
    const facetDefinitionId = facetByCode.get(seed.facetCode);
    if (!facetDefinitionId) {
      throw new Error(`Missing facet definition for rule: ${seed.facetCode}`);
    }

    const sourceAttrCode = facetDefinitionSeeds.find((f) => f.code === seed.facetCode)?.sourceAttributeCode;
    const sourceAttrId = sourceAttrCode ? attrByCode.get(sourceAttrCode)?.id : undefined;

    const existing = await prisma.facetRule.findFirst({
      where: {
        organizationId,
        facetDefinitionId,
        ruleType: mapFacetRuleType(seed.ruleType),
      },
    });

    if (existing) {
      await prisma.facetRule.update({
        where: { id: existing.id },
        data: {
          ruleConfig: seed.ruleConfig,
          attributeDefinitionId: sourceAttrId,
          workflowStateCode: "approved",
        },
      });
      stats.facetRulesUpdated++;
    } else {
      await prisma.facetRule.create({
        data: {
          organizationId,
          facetDefinitionId,
          attributeDefinitionId: sourceAttrId,
          ruleType: mapFacetRuleType(seed.ruleType),
          ruleConfig: seed.ruleConfig,
          workflowStateCode: "approved",
        },
      });
      stats.facetRulesCreated++;
    }
  }

  return stats;
}
