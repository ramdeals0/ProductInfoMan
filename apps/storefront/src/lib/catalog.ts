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

/** ASSUMPTION CHANGE: mock price when PIM has no dedicated price field */
export function resolveHitPrice(sku: string): number {
  const hash = sku.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 19.99 + (hash % 80);
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

export function productImageUrl(productId: string, title: string): string {
  const label = encodeURIComponent(title.slice(0, 16));
  return `https://placehold.co/600x600/e2e8f0/334155?text=${label}`;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
