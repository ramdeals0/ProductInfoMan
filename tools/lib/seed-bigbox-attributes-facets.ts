import type { PrismaClient } from "../../generated/prisma/client.js";
import { PRICE_FACET_BUCKETS } from "../../packages/config/facets.config.js";
import {
  BIGBOX_CATEGORIES,
  categoryPathSegments,
  listBigBoxLeafCategories,
} from "../bigbox/config.js";

export type BigBoxCategoryAttributeSeed = {
  key: string;
  label: string;
  values: readonly string[];
};

/** Two category-specific filterable attributes per big-box department. */
export const BIGBOX_CATEGORY_ATTRIBUTES: Record<string, BigBoxCategoryAttributeSeed[]> = {
  electronics: [
    { key: "connectivity", label: "Connectivity", values: ["WiFi", "Bluetooth", "Wired", "Wireless"] },
    { key: "power_type", label: "Power Type", values: ["Battery", "AC", "USB", "Rechargeable"] },
  ],
  home_garden: [
    { key: "room", label: "Room", values: ["Bedroom", "Kitchen", "Bathroom", "Outdoor", "Living Room"] },
    { key: "home_material", label: "Material", values: ["Cotton", "Ceramic", "Metal", "Wood", "Plastic"] },
  ],
  tools_hardware: [
    { key: "tool_type", label: "Tool Type", values: ["Drill", "Saw", "Hand Tools", "Measuring", "Storage"] },
    { key: "power_source", label: "Power Source", values: ["Cordless", "Corded", "Manual", "Electric"] },
  ],
  sporting_goods: [
    { key: "sport", label: "Sport", values: ["Yoga", "Basketball", "Camping", "Cycling", "Fitness"] },
    { key: "skill_level", label: "Skill Level", values: ["Beginner", "Intermediate", "Advanced"] },
  ],
  automotive: [
    { key: "vehicle_type", label: "Vehicle Type", values: ["Car", "Truck", "SUV", "Universal"] },
    { key: "product_form", label: "Product Form", values: ["Liquid", "Kit", "Accessory", "Bulb"] },
  ],
  pet_supplies: [
    { key: "pet_type", label: "Pet Type", values: ["Dog", "Cat", "Fish", "Small Pet"] },
    { key: "life_stage", label: "Life Stage", values: ["Puppy", "Adult", "Senior", "All Ages"] },
  ],
  grocery_pantry: [
    { key: "dietary", label: "Dietary", values: ["Standard", "Organic", "Gluten-Free", "Low Sodium"] },
    { key: "pack_size", label: "Pack Size", values: ["Single", "Multi-Pack", "Family Size"] },
  ],
  apparel_family: [
    { key: "apparel_style", label: "Style", values: ["Casual", "Athletic", "Workwear", "Sleepwear"] },
    { key: "season", label: "Season", values: ["All Season", "Summer", "Winter", "Spring/Fall"] },
  ],
  furniture_home: [
    { key: "finish", label: "Finish", values: ["Wood", "Metal", "Fabric", "Glass", "Laminate"] },
    { key: "assembly", label: "Assembly", values: ["Assembled", "Some Assembly", "Full Assembly"] },
  ],
  toys_games: [
    { key: "age_range", label: "Age Range", values: ["3+", "6+", "8+", "12+"] },
    { key: "toy_type", label: "Toy Type", values: ["Building", "Game", "Plush", "STEM", "Outdoor"] },
  ],
};

const GLOBAL_MERCH_KEYS = ["price", "rating", "availability", "warranty_years", "material", "fit"] as const;

async function ensureGlobalMerchAttributesExist(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const existing = await prisma.attributeDefinition.findMany({
    where: { organizationId, key: { in: [...GLOBAL_MERCH_KEYS] } },
    select: { key: true },
  });
  const missing = GLOBAL_MERCH_KEYS.filter((key) => !existing.some((row) => row.key === key));
  if (missing.length > 0) {
    throw new Error(
      `Missing global merchandising attributes: ${missing.join(", ")} — run pnpm db:seed first`,
    );
  }
}

export async function seedBigBoxAttributesAndFacets(
  prisma: PrismaClient,
  organizationId: string,
  categoryByCode: Map<string, string>,
): Promise<Map<string, string>> {
  await ensureGlobalMerchAttributesExist(prisma, organizationId);

  const specsGroup = await prisma.attributeGroup.upsert({
    where: { organizationId_code: { organizationId, code: "specifications" } },
    create: {
      organizationId,
      code: "specifications",
      name: "Specifications",
      sortOrder: 1,
    },
    update: {},
  });

  const attrByKey = new Map<string, string>();
  const globalAttrs = await prisma.attributeDefinition.findMany({
    where: {
      organizationId,
      key: {
        in: ["brand", "color", "size", "fabric", ...GLOBAL_MERCH_KEYS],
      },
    },
    select: { id: true, key: true },
  });
  for (const attr of globalAttrs) {
    attrByKey.set(attr.key, attr.id);
  }

  let facetSortOrder = 20;

  for (const category of BIGBOX_CATEGORIES) {
    const categoryId = categoryByCode.get(category.code);
    if (!categoryId) continue;

    const categoryAttrs = BIGBOX_CATEGORY_ATTRIBUTES[category.code] ?? [];
    for (const seed of categoryAttrs) {
      const attr = await prisma.attributeDefinition.upsert({
        where: { organizationId_key: { organizationId, key: seed.key } },
        create: {
          organizationId,
          attributeGroupId: specsGroup.id,
          key: seed.key,
          label: seed.label,
          dataType: "ENUM",
          isFilterable: true,
          isSearchable: true,
          allowedValuesType: "CONTROLLED_LIST",
        },
        update: {
          label: seed.label,
          isFilterable: true,
          isSearchable: true,
          allowedValuesType: "CONTROLLED_LIST",
        },
      });
      attrByKey.set(seed.key, attr.id);

      for (let i = 0; i < seed.values.length; i++) {
        const value = seed.values[i]!;
        await prisma.attributeEnumValue.upsert({
          where: {
            attributeDefinitionId_value: {
              attributeDefinitionId: attr.id,
              value,
            },
          },
          create: {
            attributeDefinitionId: attr.id,
            value,
            label: value,
            sortOrder: i,
          },
          update: { label: value, sortOrder: i },
        });
      }

      const facet = await prisma.facetDefinition.upsert({
        where: { organizationId_key: { organizationId, key: seed.key } },
        create: {
          organizationId,
          key: seed.key,
          label: seed.label,
          sourceAttributeId: attr.id,
          categoryId,
          scope: "CATEGORY",
          sortOrder: facetSortOrder++,
          isDynamic: true,
          isActive: true,
        },
        update: {
          label: seed.label,
          sourceAttributeId: attr.id,
          categoryId,
          scope: "CATEGORY",
          isActive: true,
        },
      });

      const enumValues = await prisma.attributeEnumValue.findMany({
        where: { attributeDefinitionId: attr.id },
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

      const existingRule = await prisma.facetRule.findFirst({
        where: { facetDefinitionId: facet.id, categoryId },
      });
      if (!existingRule) {
        await prisma.facetRule.create({
          data: {
            organizationId,
            categoryId,
            attributeDefinitionId: attr.id,
            facetDefinitionId: facet.id,
            ruleType: "DIRECT",
            workflowStateCode: "approved",
          },
        });
      }
    }
  }

  for (const leaf of listBigBoxLeafCategories()) {
    const { code: leafCode } = categoryPathSegments(
      leaf.departmentCode,
      leaf.subcategoryCode,
      leaf.leafCode,
    );
    const leafCategoryId = categoryByCode.get(leafCode);
    if (!leafCategoryId) continue;

    const attrSet = await prisma.categoryAttributeSet.upsert({
      where: { categoryId: leafCategoryId },
      create: { categoryId: leafCategoryId },
      update: {},
    });

    const categoryAttrs = BIGBOX_CATEGORY_ATTRIBUTES[leaf.departmentCode] ?? [];
    for (const seed of categoryAttrs) {
      const attrId = attrByKey.get(seed.key);
      if (!attrId) continue;

      await prisma.categoryAttributeBinding.upsert({
        where: {
          categoryAttributeSetId_attributeDefinitionId: {
            categoryAttributeSetId: attrSet.id,
            attributeDefinitionId: attrId,
          },
        },
        create: {
          categoryAttributeSetId: attrSet.id,
          attributeDefinitionId: attrId,
          requirement: "OPTIONAL",
          inheritFromParent: false,
        },
        update: { requirement: "OPTIONAL" },
      });
    }

    for (const globalKey of GLOBAL_MERCH_KEYS) {
      const globalAttrId = attrByKey.get(globalKey);
      if (!globalAttrId) continue;
      await prisma.categoryAttributeBinding.upsert({
        where: {
          categoryAttributeSetId_attributeDefinitionId: {
            categoryAttributeSetId: attrSet.id,
            attributeDefinitionId: globalAttrId,
          },
        },
        create: {
          categoryAttributeSetId: attrSet.id,
          attributeDefinitionId: globalAttrId,
          requirement: "OPTIONAL",
          inheritFromParent: true,
        },
        update: { requirement: "OPTIONAL", inheritFromParent: true },
      });
    }

    for (const sharedKey of ["brand", "color", "size", "fabric"] as const) {
      const sharedAttrId = attrByKey.get(sharedKey);
      if (!sharedAttrId) continue;
      await prisma.categoryAttributeBinding.upsert({
        where: {
          categoryAttributeSetId_attributeDefinitionId: {
            categoryAttributeSetId: attrSet.id,
            attributeDefinitionId: sharedAttrId,
          },
        },
        create: {
          categoryAttributeSetId: attrSet.id,
          attributeDefinitionId: sharedAttrId,
          requirement: "OPTIONAL",
          inheritFromParent: true,
        },
        update: { requirement: "OPTIONAL", inheritFromParent: true },
      });
    }
  }

  const priceFacet = await prisma.facetDefinition.findUnique({
    where: { organizationId_key: { organizationId, key: "price" } },
  });
  if (priceFacet) {
    const existingPriceRule = await prisma.facetRule.findFirst({
      where: { facetDefinitionId: priceFacet.id, ruleType: "RANGE_BUCKET" },
    });
    if (!existingPriceRule) {
      await prisma.facetRule.create({
        data: {
          organizationId,
          facetDefinitionId: priceFacet.id,
          attributeDefinitionId: attrByKey.get("price"),
          ruleType: "RANGE_BUCKET",
          ruleConfig: { buckets: PRICE_FACET_BUCKETS },
          workflowStateCode: "approved",
        },
      });
    }
  }

  return attrByKey;
}
