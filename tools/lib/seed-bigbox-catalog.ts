import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  BIGBOX_APPAREL_COLORS,
  BIGBOX_APPAREL_SIZES,
  BIGBOX_BRANDS,
  BIGBOX_CATEGORIES,
  BIGBOX_ROOT,
  type BigBoxCategorySeed,
} from "../bigbox/config.js";

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

async function loadAttributeIds(
  prisma: PrismaClient,
  organizationId: string,
): Promise<Map<string, string>> {
  const attributes = await prisma.attributeDefinition.findMany({
    where: {
      organizationId,
      key: { in: ["brand", "color", "size", "fabric"] },
    },
    select: { id: true, key: true },
  });
  const attrByKey = new Map(attributes.map((attribute) => [attribute.key, attribute.id]));
  if (!attrByKey.has("brand")) {
    throw new Error('Attribute "brand" not found — run pnpm db:seed first');
  }
  return attrByKey;
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
  const attrByKey = await loadAttributeIds(prisma, organizationId);

  let created = 0;
  let updated = 0;
  let total = 0;

  for (const category of BIGBOX_CATEGORIES) {
    const categoryId = categoryByCode.get(category.code);
    if (!categoryId) continue;

    for (let index = 1; index <= perCategory; index++) {
      const sku = padSku(skuPrefix, category.skuCode, index);
      const brand = pick(BIGBOX_BRANDS, index + total);
      const title = buildTitle(category, index);
      const description = `${title} — ${category.name} aisle at the Big Box Store demo catalog.`;

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

      await prisma.productAttributeValue.upsert({
        where: {
          productId_attributeDefinitionId: {
            productId: product.id,
            attributeDefinitionId: attrByKey.get("brand")!,
          },
        },
        create: {
          productId: product.id,
          attributeDefinitionId: attrByKey.get("brand")!,
          value: brand,
          source: "LOCAL",
        },
        update: { value: brand },
      });

      if (category.code === "apparel_family") {
        const colorAttr = attrByKey.get("color");
        const sizeAttr = attrByKey.get("size");
        if (colorAttr) {
          const color = pick(BIGBOX_APPAREL_COLORS, index);
          await prisma.productAttributeValue.upsert({
            where: {
              productId_attributeDefinitionId: {
                productId: product.id,
                attributeDefinitionId: colorAttr,
              },
            },
            create: {
              productId: product.id,
              attributeDefinitionId: colorAttr,
              value: color,
              source: "LOCAL",
            },
            update: { value: color },
          });
        }
        if (sizeAttr) {
          const size = pick(BIGBOX_APPAREL_SIZES, index);
          await prisma.productAttributeValue.upsert({
            where: {
              productId_attributeDefinitionId: {
                productId: product.id,
                attributeDefinitionId: sizeAttr,
              },
            },
            create: {
              productId: product.id,
              attributeDefinitionId: sizeAttr,
              value: size,
              source: "LOCAL",
            },
            update: { value: size },
          });
        }
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
