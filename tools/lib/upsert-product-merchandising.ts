import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ProductMerchandisingCopy } from "./product-merchandising-copy.js";

export async function upsertProductMerchandising(
  prisma: PrismaClient,
  productId: string,
  copy: ProductMerchandisingCopy,
  dates: { startDate: Date; discontinueDate: Date },
) {
  await prisma.product.update({
    where: { id: productId },
    data: {
      summary: copy.summary,
      sellingPoints: copy.sellingPoints,
      description: copy.description,
      startDate: dates.startDate,
      discontinueDate: dates.discontinueDate,
    },
  });
}
