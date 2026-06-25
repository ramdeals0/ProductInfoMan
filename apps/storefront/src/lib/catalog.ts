import type { ProductEntity } from "@productinfoman/domain";
import { createCatalogClient, type CatalogClient } from "@productinfoman/api-client";

export function getCatalogConfig() {
  const baseUrl =
    typeof window === "undefined"
      ? (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001")
      : (process.env.NEXT_PUBLIC_API_URL ?? "");

  return {
    baseUrl,
    organizationSlug: process.env.NEXT_PUBLIC_ORG_SLUG ?? "demo",
  };
}

export function createStorefrontCatalog(): CatalogClient {
  return createCatalogClient(getCatalogConfig());
}

function hashString(value: string): number {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

/** ASSUMPTION CHANGE: mock price when PIM has no dedicated price field */
export function resolveHitPrice(sku: string): number {
  return 19.99 + (hashString(sku) % 80);
}

export function resolveProductPrice(product: ProductEntity): number {
  const priceAttr = product.attributes.find((attr) => attr.key === "price");
  if (typeof priceAttr?.value === "number") return priceAttr.value;
  if (typeof priceAttr?.value === "string") {
    const parsed = Number.parseFloat(priceAttr.value);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return resolveHitPrice(product.sku);
}

export function productImageUrl(productId: string, _title?: string): string {
  const seed = productId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "product";
  return `https://picsum.photos/seed/${seed}/800/800`;
}

export function categoryImageUrl(categoryCode: string): string {
  const seed = `category-${categoryCode}`;
  return `https://picsum.photos/seed/${seed}/800/600`;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

/** Mock rating derived from SKU for display when reviews are not in the catalog API */
export function resolveProductRating(sku: string): { score: number; count: number } {
  const hash = hashString(sku);
  const score = 3.8 + (hash % 12) / 10;
  const count = 12 + (hash % 180);
  return { score: Math.round(score * 10) / 10, count };
}

export function formatRating(score: number): string {
  return score.toFixed(1);
}
