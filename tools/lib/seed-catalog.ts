import type { PrismaClient } from "../../generated/prisma/client.js";
import { FLEETFARM_CATEGORIES } from "../fleetfarm/config.js";
import type { ScrapedProduct } from "../fleetfarm/types.js";
import { ensureDemoCategories, seedAttributesAndFacets } from "./seed-attributes-facets.js";

/** @deprecated Use ensureDemoCategories from seed-attributes-facets.ts */
export async function seedDemoCategories(prisma: PrismaClient, organizationId: string) {
  return ensureDemoCategories(prisma, organizationId);
}

export async function seedDemoAttributesAndFacets(
  prisma: PrismaClient,
  organizationId: string,
  _categoryByCode?: Map<string, string>,
) {
  const stats = await seedAttributesAndFacets(prisma, organizationId);
  return stats.attrByKey;
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

/** Category codes used by the demo catalog seed pipeline. */
export const DEMO_CATALOG_CATEGORY_CODES = FLEETFARM_CATEGORIES.map((category) => category.code);
