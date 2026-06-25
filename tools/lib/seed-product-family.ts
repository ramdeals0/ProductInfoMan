import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  buildProductMerchandisingCopy,
  defaultStorefrontAvailability,
} from "./product-merchandising-copy.js";
import { upsertProductAttribute } from "./upsert-product-attribute.js";

export type SeedAttributeKeys =
  | "brand"
  | "color"
  | "size"
  | "fabric"
  | "price"
  | "rating"
  | "availability"
  | "warranty_years"
  | "material"
  | "fit";

export type SeedAttributeMap = Record<SeedAttributeKeys, string>;

export type VariantSeedSpec = {
  sku: string;
  color: string;
  size: string;
  price: number;
};

export type ParentVariantFamilySpec = {
  parentSku: string;
  title: string;
  brand: string;
  categoryId: string;
  categoryLabel: string;
  fabric: string;
  material?: string;
  fit?: string;
  variants: VariantSeedSpec[];
  copyIndex?: number;
};

export type SeedParentVariantFamilyResult = {
  parentId: string;
  variantIds: string[];
};

export async function seedParentVariantFamily(
  prisma: PrismaClient,
  organizationId: string,
  attributes: SeedAttributeMap,
  spec: ParentVariantFamilySpec,
  publish = true,
): Promise<SeedParentVariantFamilyResult> {
  const copyIndex = spec.copyIndex ?? 1;
  const parentCopy = buildProductMerchandisingCopy(spec.title, spec.categoryLabel, copyIndex);
  const parentDates = defaultStorefrontAvailability(copyIndex);
  const status = publish ? "PUBLISHED" : "DRAFT";

  const parent = await prisma.product.upsert({
    where: { organizationId_sku: { organizationId, sku: spec.parentSku } },
    create: {
      organizationId,
      productType: "PARENT",
      sku: spec.parentSku,
      title: spec.title,
      description: parentCopy.description,
      summary: parentCopy.summary,
      sellingPoints: parentCopy.sellingPoints,
      brand: spec.brand,
      primaryCategoryId: spec.categoryId,
      startDate: parentDates.startDate,
      discontinueDate: parentDates.discontinueDate,
      status,
    },
    update: {
      productType: "PARENT",
      title: spec.title,
      description: parentCopy.description,
      summary: parentCopy.summary,
      sellingPoints: parentCopy.sellingPoints,
      brand: spec.brand,
      primaryCategoryId: spec.categoryId,
      startDate: parentDates.startDate,
      discontinueDate: parentDates.discontinueDate,
      status,
      deletedAt: null,
    },
  });

  await upsertProductAttribute(prisma, parent.id, attributes.brand, spec.brand);
  await upsertProductAttribute(prisma, parent.id, attributes.fabric, spec.fabric);
  await upsertProductAttribute(prisma, parent.id, attributes.material, spec.material ?? spec.fabric);
  await upsertProductAttribute(prisma, parent.id, attributes.fit, spec.fit ?? "Regular");
  await upsertProductAttribute(prisma, parent.id, attributes.price, spec.variants[0]?.price ?? 49.99);
  await upsertProductAttribute(prisma, parent.id, attributes.rating, 4.5);
  await upsertProductAttribute(prisma, parent.id, attributes.availability, "In Stock");
  await upsertProductAttribute(prisma, parent.id, attributes.warranty_years, 2);

  const variantIds: string[] = [];

  for (const [variantIndex, variantSpec] of spec.variants.entries()) {
    const variantCopy = buildProductMerchandisingCopy(
      spec.title,
      spec.categoryLabel,
      copyIndex + variantIndex + 1,
    );
    const variantDates = defaultStorefrontAvailability(copyIndex + variantIndex + 1);

    const variant = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId, sku: variantSpec.sku } },
      create: {
        organizationId,
        productType: "VARIANT",
        sku: variantSpec.sku,
        parentId: parent.id,
        title: spec.title,
        description: variantCopy.description,
        summary: variantCopy.summary,
        sellingPoints: variantCopy.sellingPoints,
        brand: spec.brand,
        primaryCategoryId: spec.categoryId,
        startDate: variantDates.startDate,
        discontinueDate: variantDates.discontinueDate,
        status,
      },
      update: {
        productType: "VARIANT",
        parentId: parent.id,
        title: spec.title,
        description: variantCopy.description,
        summary: variantCopy.summary,
        sellingPoints: variantCopy.sellingPoints,
        brand: spec.brand,
        primaryCategoryId: spec.categoryId,
        startDate: variantDates.startDate,
        discontinueDate: variantDates.discontinueDate,
        status,
        deletedAt: null,
      },
    });

    variantIds.push(variant.id);

    await upsertProductAttribute(prisma, variant.id, attributes.color, variantSpec.color);
    await upsertProductAttribute(prisma, variant.id, attributes.size, variantSpec.size);
    await upsertProductAttribute(prisma, variant.id, attributes.fabric, spec.fabric);
    await upsertProductAttribute(prisma, variant.id, attributes.price, variantSpec.price);
    await upsertProductAttribute(prisma, variant.id, attributes.rating, 4.3);
    await upsertProductAttribute(prisma, variant.id, attributes.availability, "In Stock");
    await upsertProductAttribute(prisma, variant.id, attributes.warranty_years, 2);
    await upsertProductAttribute(prisma, variant.id, attributes.material, spec.material ?? spec.fabric);
    await upsertProductAttribute(prisma, variant.id, attributes.fit, spec.fit ?? "Regular");
  }

  return { parentId: parent.id, variantIds };
}

export const DEMO_PARENT_VARIANT_FAMILIES: Omit<
  ParentVariantFamilySpec,
  "categoryId" | "categoryLabel"
>[] = [
  {
    parentSku: "SHIRT-001",
    title: "Classic Oxford Shirt",
    brand: "Acme",
    fabric: "Cotton",
    variants: [
      { sku: "SHIRT-001-BL-M", color: "Blue", size: "M", price: 49.99 },
      { sku: "SHIRT-001-BL-L", color: "Blue", size: "L", price: 49.99 },
      { sku: "SHIRT-001-WH-M", color: "White", size: "M", price: 47.99 },
    ],
    copyIndex: 1,
  },
  {
    parentSku: "POLO-001",
    title: "Performance Work Polo",
    brand: "Summit",
    fabric: "Poly Blend",
    material: "Polyester",
    fit: "Regular",
    variants: [
      { sku: "POLO-001-NV-M", color: "Navy", size: "M", price: 39.99 },
      { sku: "POLO-001-BL-L", color: "Blue", size: "L", price: 39.99 },
      { sku: "POLO-001-WH-S", color: "White", size: "S", price: 37.99 },
    ],
    copyIndex: 10,
  },
  {
    parentSku: "FLANNEL-001",
    title: "Heritage Flannel Shirt",
    brand: "Northline",
    fabric: "Cotton",
    fit: "Relaxed",
    variants: [
      { sku: "FLANNEL-001-BL-M", color: "Blue", size: "M", price: 54.99 },
      { sku: "FLANNEL-001-NV-L", color: "Navy", size: "L", price: 54.99 },
      { sku: "FLANNEL-001-WH-M", color: "White", size: "M", price: 52.99 },
    ],
    copyIndex: 20,
  },
  {
    parentSku: "DRESS-001",
    title: "Spread Collar Dress Shirt",
    brand: "Harbor",
    fabric: "Cotton",
    fit: "Slim",
    variants: [
      { sku: "DRESS-001-WH-M", color: "White", size: "M", price: 59.99 },
      { sku: "DRESS-001-BL-L", color: "Blue", size: "L", price: 59.99 },
      { sku: "DRESS-001-NV-M", color: "Navy", size: "M", price: 61.99 },
    ],
    copyIndex: 30,
  },
  {
    parentSku: "BTN-001",
    title: "Button-Down Oxford",
    brand: "Fieldworks",
    fabric: "Cotton",
    variants: [
      { sku: "BTN-001-BL-S", color: "Blue", size: "S", price: 44.99 },
      { sku: "BTN-001-WH-M", color: "White", size: "M", price: 44.99 },
      { sku: "BTN-001-NV-L", color: "Navy", size: "L", price: 46.99 },
      { sku: "BTN-001-BL-L", color: "Blue", size: "L", price: 44.99 },
    ],
    copyIndex: 40,
  },
];

export async function seedDemoParentVariantFamilies(
  prisma: PrismaClient,
  organizationId: string,
  attributes: SeedAttributeMap,
  categoryByCode: Record<string, { id: string; name: string }>,
  publish = true,
): Promise<SeedParentVariantFamilyResult[]> {
  const categoryCodes = {
    "SHIRT-001": "oxford",
    "POLO-001": "oxford",
    "FLANNEL-001": "flannel",
    "DRESS-001": "spread_collar",
    "BTN-001": "button_down",
  } as const;

  const results: SeedParentVariantFamilyResult[] = [];

  for (const family of DEMO_PARENT_VARIANT_FAMILIES) {
    const categoryCode = categoryCodes[family.parentSku as keyof typeof categoryCodes];
    const category = categoryByCode[categoryCode];
    if (!category) {
      throw new Error(`Category "${categoryCode}" not found for ${family.parentSku}`);
    }

    results.push(
      await seedParentVariantFamily(
        prisma,
        organizationId,
        attributes,
        {
          ...family,
          categoryId: category.id,
          categoryLabel: category.name,
        },
        publish,
      ),
    );
  }

  return results;
}
