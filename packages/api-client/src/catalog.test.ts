import { describe, expect, it } from "vitest";
import { CatalogClient } from "./catalog";

describe("CatalogClient", () => {
  it("builds search query with facet filters", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({ items: [], total: 0, page: 1, pageSize: 12 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    const client = new CatalogClient({
      baseUrl: "http://localhost:3001",
      organizationSlug: "demo",
    });

    await client.searchProducts({
      q: "drill",
      categoryId: "cat-1",
      page: 2,
      filters: { color: ["Red", "Blue"], brand: "Acme" },
    });

    expect(capturedUrl).toContain("/api/v1/search?");
    expect(capturedUrl).toContain("q=drill");
    expect(capturedUrl).toContain("categoryId=cat-1");
    expect(capturedUrl).toContain("page=2");
    expect(capturedUrl).toContain("filters%5Bcolor%5D=Red");
    expect(capturedUrl).toContain("filters%5Bcolor%5D=Blue");
    expect(capturedUrl).toContain("filters%5Bbrand%5D=Acme");
    expect(new Headers(capturedInit?.headers).get("Content-Type")).toBeNull();

    globalThis.fetch = originalFetch;
  });
});
