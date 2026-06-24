import type { PrismaClient } from "../../generated/prisma/client.js";

export async function upsertProductAttribute(
  prisma: PrismaClient,
  productId: string,
  attributeDefinitionId: string,
  value: string | number | boolean,
) {
  await prisma.productAttributeValue.upsert({
    where: {
      productId_attributeDefinitionId: {
        productId,
        attributeDefinitionId,
      },
    },
    create: {
      productId,
      attributeDefinitionId,
      value,
      source: "LOCAL",
    },
    update: { value },
  });
}
