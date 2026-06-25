import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  buildProductMerchandisingCopy,
  defaultStorefrontAvailability,
} from "./product-merchandising-copy.js";
import { merchandisingValuesForIndex } from "./product-attribute-values.js";
import { seedDemoParentVariantFamilies } from "./seed-product-family.js";
import { upsertProductAttribute } from "./upsert-product-attribute.js";

export type SeedDemoProductsOptions = {
  count?: number;
  skuPrefix?: string;
  publish?: boolean;
};

export type SeedDemoProductsResult = {
  created: number;
  updated: number;
  total: number;
  parentFamilies: number;
  variants: number;
};

const BRANDS = ["Acme", "Northline", "Summit", "Harbor", "Fieldworks"] as const;
const SHIRT_LEAF_CODES = ["oxford", "flannel", "spread_collar", "button_down"] as const;
const COLORS = ["Blue", "White", "Navy"] as const;
const SIZES = ["S", "M", "L"] as const;
const FABRICS = ["Cotton", "Poly Blend", "Linen", "Performance Knit"] as const;
const STYLES = [
  "Oxford Shirt",
  "Performance Tee",
  "Work Polo",
  "Flannel Shirt",
  "Henley",
  "Chino Pant",
  "Utility Jacket",
  "Canvas Short",
] as const;

const REQUIRED_ATTR_KEYS = [
  "brand",
  "color",
  "size",
  "fabric",
  "price",
  "rating",
  "availability",
  "warranty_years",
  "material",
  "fit",
] as const;

function padSku(prefix: string, index: number): string {
  return `${prefix}-${String(index).padStart(5, "0")}`;
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

export async function seedDemoProducts(
  prisma: PrismaClient,
  organizationId: string,
  options: SeedDemoProductsOptions = {},
): Promise<SeedDemoProductsResult> {
  const count = options.count ?? 500;
  const skuPrefix = options.skuPrefix ?? "DEMO";
  const publish = options.publish ?? true;

  const leafCategories = await prisma.category.findMany({
    where: {
      organizationId,
      code: { in: [...SHIRT_LEAF_CODES] },
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  if (leafCategories.length !== SHIRT_LEAF_CODES.length) {
    const found = new Set(leafCategories.map((category) => category.code));
    const missing = SHIRT_LEAF_CODES.filter((code) => !found.has(code));
    throw new Error(
      `Shirt leaf categories not found (${missing.join(", ")}) — run pnpm db:seed first`,
    );
  }

  const attributes = await prisma.attributeDefinition.findMany({
    where: {
      organizationId,
      key: { in: [...REQUIRED_ATTR_KEYS] },
    },
    select: { id: true, key: true },
  });
  const attrByKey = new Map(attributes.map((attribute) => [attribute.key, attribute.id]));
  for (const key of REQUIRED_ATTR_KEYS) {
    if (!attrByKey.has(key)) {
      throw new Error(`Attribute "${key}" not found — run pnpm db:seed first`);
    }
  }

  const categoryByCode = Object.fromEntries(leafCategories.map((category) => [category.code, category]));
  const parentVariantResults = await seedDemoParentVariantFamilies(
    prisma,
    organizationId,
    {
      brand: attrByKey.get("brand")!,
      color: attrByKey.get("color")!,
      size: attrByKey.get("size")!,
      fabric: attrByKey.get("fabric")!,
      price: attrByKey.get("price")!,
      rating: attrByKey.get("rating")!,
      availability: attrByKey.get("availability")!,
      warranty_years: attrByKey.get("warranty_years")!,
      material: attrByKey.get("material")!,
      fit: attrByKey.get("fit")!,
    },
    categoryByCode,
    publish,
  );

  let created = 0;
  let updated = 0;

  for (let index = 1; index <= count; index++) {
    const sku = padSku(skuPrefix, index);
    const brand = pick(BRANDS, index);
    const color = pick(COLORS, index);
    const size = pick(SIZES, index);
    const fabric = pick(FABRICS, index);
    const style = pick(STYLES, index);
    const title = `${brand} ${style} ${index}`;
    const merch = merchandisingValuesForIndex(index);
    const leaf = pick(leafCategories, index);
    const copy = buildProductMerchandisingCopy(title, leaf.name, index);
    const dates = defaultStorefrontAvailability(index);

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
        primaryCategoryId: leaf.id,
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
        primaryCategoryId: leaf.id,
        startDate: dates.startDate,
        discontinueDate: dates.discontinueDate,
        status: publish ? "PUBLISHED" : "DRAFT",
        deletedAt: null,
      },
    });

    if (existing) updated++;
    else created++;

    const attributeValues = [
      { key: "brand", value: brand },
      { key: "color", value: color },
      { key: "size", value: size },
      { key: "fabric", value: fabric },
      { key: "price", value: merch.price },
      { key: "rating", value: merch.rating },
      { key: "availability", value: merch.availability },
      { key: "warranty_years", value: merch.warranty_years },
      { key: "material", value: merch.material },
      { key: "fit", value: merch.fit },
    ] as const;

    for (const { key, value } of attributeValues) {
      await upsertProductAttribute(prisma, product.id, attrByKey.get(key)!, value);
    }
  }

  return {
    created,
    updated,
    total: count,
    parentFamilies: parentVariantResults.length,
    variants: parentVariantResults.reduce((sum, family) => sum + family.variantIds.length, 0),
  };
}
