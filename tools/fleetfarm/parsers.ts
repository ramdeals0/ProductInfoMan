import { ROBOTS_DISALLOWED_PREFIXES } from "./config.js";

export function isUrlAllowedByRobots(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return !ROBOTS_DISALLOWED_PREFIXES.some((prefix) => {
      const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
      return pathname.startsWith(normalized) || pathname === prefix.replace(/\/$/, "");
    });
  } catch {
    return false;
  }
}

export type ParsedListItem = {
  title: string;
  productUrl: string;
  price?: number;
  brand?: string;
};

export function parsePrice(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/(\d+(?:\.\d{2})?)/);
  return match ? Number.parseFloat(match[1]!) : null;
}

/** Extract JSON-LD Product blocks when present in retailer HTML. */
export function parseJsonLdProducts(html: string): Array<Record<string, unknown>> {
  const products: Array<Record<string, unknown>> = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!.trim()) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        if (record["@type"] === "Product") products.push(record);
        if (Array.isArray(record["@graph"])) {
          for (const item of record["@graph"]) {
            if (item && typeof item === "object" && (item as Record<string, unknown>)["@type"] === "Product") {
              products.push(item as Record<string, unknown>);
            }
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }

  return products;
}

export function parseProductListHtml(html: string, baseUrl: string): ParsedListItem[] {
  const jsonLdProducts = parseJsonLdProducts(html);
  if (jsonLdProducts.length > 0) {
    return jsonLdProducts
      .map((product) => {
        const title = String(product.name ?? "");
        const productUrl = String(product.url ?? product["@id"] ?? "");
        const offers = product.offers as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
        const offer = Array.isArray(offers) ? offers[0] : offers;
        const price = parsePrice(String(offer?.price ?? ""));
        const brandRecord = product.brand as Record<string, unknown> | string | undefined;
        const brand =
          typeof brandRecord === "string" ? brandRecord : String(brandRecord?.name ?? "");
        if (!title || !productUrl) return null;
        return { title, productUrl: new URL(productUrl, baseUrl).href, price: price ?? undefined, brand: brand || undefined };
      })
      .filter((item): item is ParsedListItem => item !== null);
  }

  // Fallback: anchor tags with nearby price-like text (minimal heuristic parser).
  const items: ParsedListItem[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1]!;
    const text = linkMatch[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text || text.length < 8 || text.length > 120) continue;
    if (!/product|item|sku|detail/i.test(href) && !href.includes("/p/")) continue;
    const context = html.slice(linkMatch.index, linkMatch.index + 500);
    const price = parsePrice(context);
    items.push({
      title: text,
      productUrl: new URL(href, baseUrl).href,
      price: price ?? undefined,
    });
    if (items.length >= 100) break;
  }

  return items;
}

export function parseProductDetailHtml(
  html: string,
  base: { externalId: string; productUrl: string; categoryPath: string[]; categoryCode: string },
): import("./types.js").ScrapedProduct | null {
  const jsonLd = parseJsonLdProducts(html)[0];
  if (!jsonLd) return null;

  const title = String(jsonLd.name ?? "");
  if (!title) return null;

  const offers = jsonLd.offers as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  const price = parsePrice(String(offer?.price ?? ""));
  const brandRecord = jsonLd.brand as Record<string, unknown> | string | undefined;
  const brand = typeof brandRecord === "string" ? brandRecord : String(brandRecord?.name ?? "");

  const attributes: Record<string, string | number | boolean> = {};
  if (brand) attributes.brand = brand;
  if (price != null) attributes.price = price;

  const additional = jsonLd.additionalProperty;
  if (Array.isArray(additional)) {
    for (const prop of additional) {
      if (!prop || typeof prop !== "object") continue;
      const record = prop as Record<string, unknown>;
      const key = String(record.name ?? record.propertyID ?? "").trim();
      const value = record.value;
      if (key && value != null) attributes[key.toLowerCase().replace(/\s+/g, "_")] = String(value);
    }
  }

  return {
    externalId: base.externalId,
    title,
    price,
    brand: brand || undefined,
    description: String(jsonLd.description ?? ""),
    productUrl: base.productUrl,
    categoryPath: base.categoryPath,
    categoryCode: base.categoryCode,
    attributes,
  };
}
