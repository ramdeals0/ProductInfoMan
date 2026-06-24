import { describe, expect, it } from "vitest";
import {
  canApproveWorkflow,
  canEditProducts,
  canManageImports,
  canManagePublishing,
  canSubmitForReview,
} from "./roles";

describe("role helpers", () => {
  it("allows editors to submit products for review", () => {
    expect(canSubmitForReview("EDITOR")).toBe(true);
    expect(canApproveWorkflow("EDITOR")).toBe(false);
  });

  it("allows reviewers to approve workflow tasks", () => {
    expect(canApproveWorkflow("REVIEWER")).toBe(true);
    expect(canEditProducts("REVIEWER")).toBe(false);
  });

  it("allows operations role to manage imports and publishing", () => {
    expect(canManageImports("OPERATIONS")).toBe(true);
    expect(canManagePublishing("OPERATIONS")).toBe(true);
    expect(canEditProducts("OPERATIONS")).toBe(false);
  });

  it("grants admin full MVP permissions", () => {
    expect(canEditProducts("ADMIN")).toBe(true);
    expect(canApproveWorkflow("ADMIN")).toBe(true);
    expect(canManagePublishing("ADMIN")).toBe(true);
  });
});
