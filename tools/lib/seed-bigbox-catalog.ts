import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  BIGBOX_APPAREL_COLORS,
  BIGBOX_APPAREL_SIZES,
  BIGBOX_BRANDS,
  BIGBOX_CATEGORIES,
  BIGBOX_CATEGORY_TREE,
  BIGBOX_ROOT,
  categoryPathSegments,
  listBigBoxLeafCategories,
  type BigBoxCategorySeed,
} from "../bigbox/config.js";
import {
  BIGBOX_CATEGORY_ATTRIBUTES,
  seedBigBoxAttributesAndFacets,
} from "./seed-bigbox-attributes-facets.js";
import {
  buildProductMerchandisingCopy,
  defaultStorefrontAvailability,
} from "./product-merchandising-copy.js";
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

function slugify(code: string): string {
  return code.replace(/_/g, "-");
}

function padSku(prefix: string, leafSku: string, index: number): string {
  return `${prefix}-${leafSku}-${String(index).padStart(3, "0")}`;
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

  for (const [deptIndex, department] of BIGBOX_CATEGORIES.entries()) {
    const deptSlug = slugify(department.code);
    const departmentRow = await prisma.category.upsert({
      where: { organizationId_code: { organizationId, code: department.code } },
      create: {
        organizationId,
        parentId: root.id,
        code: department.code,
        name: department.name,
        slug: deptSlug,
        path: `${BIGBOX_ROOT.path}/${deptSlug}`,
        depth: 1,
        sortOrder: deptIndex,
      },
      update: {
        parentId: root.id,
        name: department.name,
        path: `${BIGBOX_ROOT.path}/${deptSlug}`,
        isActive: true,
        status: "ACTIVE",
      },
    });
    categoryByCode.set(department.code, departmentRow.id);

    const subcategories = BIGBOX_CATEGORY_TREE[department.code] ?? [];
    for (const [subIndex, subcategory] of subcategories.entries()) {
      const subSlug = slugify(subcategory.code);
      const subPath = `${BIGBOX_ROOT.path}/${deptSlug}/${subSlug}`;
      const subCode = `${department.code}__${subcategory.code}`;
      const subcategoryRow = await prisma.category.upsert({
        where: { organizationId_code: { organizationId, code: subCode } },
        create: {
          organizationId,
          parentId: departmentRow.id,
          code: subCode,
          name: subcategory.name,
          slug: subSlug,
          path: subPath,
          depth: 2,
          sortOrder: subIndex,
        },
        update: {
          parentId: departmentRow.id,
          name: subcategory.name,
          path: subPath,
          isActive: true,
          status: "ACTIVE",
        },
      });
      categoryByCode.set(subCode, subcategoryRow.id);

      for (const [leafIndex, leaf] of subcategory.leaves.entries()) {
        const { slug, path, code } = categoryPathSegments(
          department.code,
          subcategory.code,
          leaf.code,
        );
        const leafRow = await prisma.category.upsert({
          where: { organizationId_code: { organizationId, code } },
          create: {
            organizationId,
            parentId: subcategoryRow.id,
            code,
            name: leaf.name,
            slug,
            path,
            depth: 3,
            sortOrder: leafIndex,
          },
          update: {
            parentId: subcategoryRow.id,
            name: leaf.name,
            path,
            isActive: true,
            status: "ACTIVE",
          },
        });
        categoryByCode.set(code, leafRow.id);
      }
    }
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

  const leaves = listBigBoxLeafCategories();
  const leavesByDepartment = new Map<string, typeof leaves>();
  for (const leaf of leaves) {
    const bucket = leavesByDepartment.get(leaf.departmentCode) ?? [];
    bucket.push(leaf);
    leavesByDepartment.set(leaf.departmentCode, bucket);
  }

  let created = 0;
  let updated = 0;
  let total = 0;

  for (const department of BIGBOX_CATEGORIES) {
    const departmentLeaves = leavesByDepartment.get(department.code) ?? [];
    if (departmentLeaves.length === 0) continue;

    const productsPerLeaf = Math.max(1, Math.ceil(perCategory / departmentLeaves.length));
    const categoryAttrs = BIGBOX_CATEGORY_ATTRIBUTES[department.code] ?? [];

    for (const leaf of departmentLeaves) {
      const { code: leafCategoryCode } = categoryPathSegments(
        leaf.departmentCode,
        leaf.subcategoryCode,
        leaf.leafCode,
      );
      const categoryId = categoryByCode.get(leafCategoryCode);
      if (!categoryId) continue;

      const leafSku = `${leaf.departmentSkuCode}-${leaf.leafCode.toUpperCase().replace(/_/g, "")}`;

      for (let index = 1; index <= productsPerLeaf; index++) {
        const sku = padSku(skuPrefix, leafSku, index);
        const brand = pick(BIGBOX_BRANDS, index + total);
        const title = buildTitle(department, index);
        const copy = buildProductMerchandisingCopy(title, leaf.leafName, total + index);
        const dates = defaultStorefrontAvailability(total + index);
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
            description: copy.description,
            summary: copy.summary,
            sellingPoints: copy.sellingPoints,
            brand,
            primaryCategoryId: categoryId,
            startDate: dates.startDate,
            discontinueDate: dates.discontinueDate,
            status: publish ? "PUBLISHED" : "DRAFT",
          },
          update: {
            title,
            description: copy.description,
            summary: copy.summary,
            sellingPoints: copy.sellingPoints,
            brand,
            primaryCategoryId: categoryId,
            startDate: dates.startDate,
            discontinueDate: dates.discontinueDate,
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

        if (department.code === "apparel_family") {
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
  }

  return {
    categoriesEnsured: categoryByCode.size,
    created,
    updated,
    total,
  };
}
