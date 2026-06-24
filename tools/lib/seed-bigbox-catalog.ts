import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  BIGBOX_APPAREL_COLORS,
  BIGBOX_APPAREL_SIZES,
  BIGBOX_BRANDS,
  BIGBOX_CATEGORIES,
  BIGBOX_ROOT,
  type BigBoxCategorySeed,
} from "../bigbox/config.js";
import {
  BIGBOX_CATEGORY_ATTRIBUTES,
  seedBigBoxAttributesAndFacets,
} from "./seed-bigbox-attributes-facets.js";
import { merchandisingValuesForIndex, pickFrom } from "./product-attribute-values.js";
import { upsertProductAttribute } from "./upsert-product-attribute.js";

export type SeedBigBoxOptions = {
  perCategory?: number;
  publish?: boolean;
  skuPrefix?: string;
};

export type SeedBigBoxResult = {
  categoriesEnsured: number;
  created: number;
  updated: number;
  total: number;
};

function padSku(prefix: string, categoryCode: string, index: number): string {
  return `${prefix}-${categoryCode}-${String(index).padStart(3, "0")}`;
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

export async function ensureBigBoxCategories(
  prisma: PrismaClient,
  organizationId: string,
): Promise<Map<string, string>> {
  const categoryByCode = new Map<string, string>();

  const root = await prisma.category.upsert({
    where: { organizationId_code: { organizationId, code: BIGBOX_ROOT.code } },
    create: {
      organizationId,
      code: BIGBOX_ROOT.code,
      name: BIGBOX_ROOT.name,
      slug: BIGBOX_ROOT.slug,
      path: BIGBOX_ROOT.path,
      depth: 0,
    },
    update: { name: BIGBOX_ROOT.name, isActive: true, status: "ACTIVE" },
  });
  categoryByCode.set(root.code, root.id);

  for (const [index, category] of BIGBOX_CATEGORIES.entries()) {
    const slug = category.code.replace(/_/g, "-");
    const row = await prisma.category.upsert({
      where: { organizationId_code: { organizationId, code: category.code } },
      create: {
        organizationId,
        parentId: root.id,
        code: category.code,
        name: category.name,
        slug,
        path: `${BIGBOX_ROOT.path}/${slug}`,
        depth: 1,
        sortOrder: index,
      },
      update: {
        parentId: root.id,
        name: category.name,
        path: `${BIGBOX_ROOT.path}/${slug}`,
        isActive: true,
        status: "ACTIVE",
      },
    });
    categoryByCode.set(category.code, row.id);
  }

  return categoryByCode;
}

function buildTitle(category: BigBoxCategorySeed, index: number): string {
  const brand = pick(BIGBOX_BRANDS, index);
  const stem = pick(category.productStems, index);
  return `${brand} ${stem}`;
}

export async function seedBigBoxProducts(
  prisma: PrismaClient,
  organizationId: string,
  options: SeedBigBoxOptions = {},
): Promise<SeedBigBoxResult> {
  const perCategory = options.perCategory ?? 50;
  const publish = options.publish ?? true;
  const skuPrefix = options.skuPrefix ?? "BBX";

  const categoryByCode = await ensureBigBoxCategories(prisma, organizationId);
  const attrByKey = await seedBigBoxAttributesAndFacets(prisma, organizationId, categoryByCode);

  let created = 0;
  let updated = 0;
  let total = 0;

  for (const category of BIGBOX_CATEGORIES) {
    const categoryId = categoryByCode.get(category.code);
    if (!categoryId) continue;

    const categoryAttrs = BIGBOX_CATEGORY_ATTRIBUTES[category.code] ?? [];

    for (let index = 1; index <= perCategory; index++) {
      const sku = padSku(skuPrefix, category.skuCode, index);
      const brand = pick(BIGBOX_BRANDS, index + total);
      const title = buildTitle(category, index);
      const description = `${title} — ${category.name} aisle at the Big Box Store demo catalog.`;
      const merch = merchandisingValuesForIndex(total + index);

      const existing = await prisma.product.findUnique({
        where: { organizationId_sku: { organizationId, sku } },
      });

      const product = await prisma.product.upsert({
        where: { organizationId_sku: { organizationId, sku } },
        create: {
          organizationId,
          productType: "SIMPLE",
          sku,
          title,
          description,
          brand,
          primaryCategoryId: categoryId,
          status: publish ? "PUBLISHED" : "DRAFT",
        },
        update: {
          title,
          description,
          brand,
          primaryCategoryId: categoryId,
          status: publish ? "PUBLISHED" : "DRAFT",
          deletedAt: null,
        },
      });

      if (existing) updated++;
      else created++;

      const attributeValues: Array<{ key: string; value: string | number }> = [
        { key: "brand", value: brand },
        { key: "price", value: merch.price },
        { key: "rating", value: merch.rating },
        { key: "availability", value: merch.availability },
        { key: "warranty_years", value: merch.warranty_years },
        { key: "material", value: merch.material },
        { key: "fit", value: merch.fit },
      ];

      for (const [attrIndex, categoryAttr] of categoryAttrs.entries()) {
        attributeValues.push({
          key: categoryAttr.key,
          value: pickFrom(categoryAttr.values, index + attrIndex),
        });
      }

      if (category.code === "apparel_family") {
        attributeValues.push(
          { key: "color", value: pick(BIGBOX_APPAREL_COLORS, index) },
          { key: "size", value: pick(BIGBOX_APPAREL_SIZES, index) },
          { key: "fabric", value: pickFrom(["Cotton", "Poly Blend", "Fleece", "Denim"], index) },
        );
      }

      for (const { key, value } of attributeValues) {
        const attributeDefinitionId = attrByKey.get(key);
        if (!attributeDefinitionId) continue;
        await upsertProductAttribute(prisma, product.id, attributeDefinitionId, value);
      }

      total++;
    }
  }

  return {
    categoriesEnsured: categoryByCode.size,
    created,
    updated,
    total,
  };
}
