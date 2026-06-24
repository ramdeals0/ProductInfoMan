import { describe, expect, it } from "vitest";
import {
  canApproveWorkflow,
  canEditProducts,
  canManageImports,
  canManagePublishing,
  canSubmitForReview,
} from "./permissions";

describe("permission helpers", () => {
  it("allows product editors to submit products for review", () => {
    expect(canSubmitForReview(["product_editor"])).toBe(true);
    expect(canApproveWorkflow(["product_editor"])).toBe(false);
  });

  it("allows product approvers to approve workflow tasks", () => {
    expect(canApproveWorkflow(["product_approver"])).toBe(true);
    expect(canEditProducts(["product_approver"])).toBe(false);
  });

  it("allows ops role to manage imports and publishing", () => {
    expect(canManageImports(["ops"])).toBe(true);
    expect(canManagePublishing(["ops"])).toBe(true);
    expect(canEditProducts(["ops"])).toBe(false);
  });

  it("grants admin full MVP permissions", () => {
    expect(canEditProducts(["admin"])).toBe(true);
    expect(canApproveWorkflow(["admin"])).toBe(true);
    expect(canManagePublishing(["admin"])).toBe(true);
  });

  it("allows readonly users to read but not write", () => {
    expect(canEditProducts(["readonly"])).toBe(false);
    expect(canManageImports(["readonly"])).toBe(false);
  });
});
