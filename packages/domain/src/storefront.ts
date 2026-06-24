import type { ProductStatus } from "./index.js";

export type StorefrontAvailabilityInput = {
  status: ProductStatus;
  startDate?: string | Date | null;
  discontinueDate?: string | Date | null;
};

function toDayStart(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Published products are storefront-visible when within [startDate, discontinueDate). */
export function isStorefrontVisible(
  product: StorefrontAvailabilityInput,
  now: Date = new Date(),
): boolean {
  if (product.status !== "PUBLISHED") return false;

  const today = toDayStart(now);

  if (product.startDate) {
    if (today < toDayStart(product.startDate)) return false;
  }

  if (product.discontinueDate) {
    if (today >= toDayStart(product.discontinueDate)) return false;
  }

  return true;
}
