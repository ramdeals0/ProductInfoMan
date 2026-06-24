import { describe, expect, it } from "vitest";
import {
  buildIdempotencyKey,
  resolveAggregate,
  validateEventPayload,
} from "./index.js";

describe("validateEventPayload", () => {
  it("validates product.created payloads", () => {
    const result = validateEventPayload("product.created", {
      productId: "p1",
      sku: "SKU-1",
      productType: "SIMPLE",
      status: "DRAFT",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid payloads", () => {
    const result = validateEventPayload("product.created", { sku: "missing-id" });
    expect(result.valid).toBe(false);
  });
});

describe("buildIdempotencyKey", () => {
  it("combines event id and consumer name", () => {
    expect(buildIdempotencyKey("evt-1", "search-sync")).toBe("evt-1:search-sync");
  });
});

describe("resolveAggregate", () => {
  it("resolves product aggregates", () => {
    expect(
      resolveAggregate("product.updated", { productId: "prod-1", changedFields: [] }),
    ).toEqual({ aggregateType: "Product", aggregateId: "prod-1" });
  });
});
