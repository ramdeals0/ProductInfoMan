import { describe, expect, it } from "vitest";
import { resolveHitPrice } from "./catalog";

describe("catalog helpers", () => {
  it("derives stable mock prices from SKU", () => {
    expect(resolveHitPrice("SKU-ABC")).toBe(resolveHitPrice("SKU-ABC"));
    expect(resolveHitPrice("SKU-ABC")).not.toBe(resolveHitPrice("SKU-XYZ"));
  });
});
