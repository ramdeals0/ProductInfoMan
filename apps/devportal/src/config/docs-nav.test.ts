import { describe, expect, it } from "vitest";
import { docsNav, flattenNavItems } from "@/config/docs-nav";

describe("docs navigation", () => {
  it("includes all required sections", () => {
    const titles = docsNav.map((section) => section.title);
    expect(titles).toContain("Getting started");
    expect(titles).toContain("Admin APIs");
    expect(titles).toContain("Storefront");
  });

  it("has unique hrefs", () => {
    const hrefs = flattenNavItems().map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("covers acceptance-criteria doc routes", () => {
    const hrefs = new Set(flattenNavItems().map((item) => item.href));
    expect(hrefs.has("/docs/overview")).toBe(true);
    expect(hrefs.has("/docs/admin-products")).toBe(true);
    expect(hrefs.has("/docs/storefront-catalog")).toBe(true);
  });
});
