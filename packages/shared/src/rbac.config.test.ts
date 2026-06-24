import { describe, expect, it } from "vitest";
import { hasCapability, hasCapabilityGroup } from "./rbac.config.js";

describe("rbac capabilities", () => {
  it("grants admin wildcard access", () => {
    expect(hasCapability(["admin"], "users.manage")).toBe(true);
    expect(hasCapabilityGroup(["admin"], "ADMIN_ONLY")).toBe(true);
  });

  it("allows product editors to edit products but not manage users", () => {
    expect(hasCapabilityGroup(["product_editor"], "PRODUCT_WRITE")).toBe(true);
    expect(hasCapabilityGroup(["product_editor"], "ADMIN_ONLY")).toBe(false);
  });

  it("blocks readonly users from write capabilities", () => {
    expect(hasCapabilityGroup(["readonly"], "READ")).toBe(true);
    expect(hasCapabilityGroup(["readonly"], "PRODUCT_WRITE")).toBe(false);
    expect(hasCapabilityGroup(["readonly"], "IMPORT_OPS")).toBe(false);
  });
});
