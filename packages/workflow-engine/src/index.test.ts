import { describe, expect, it } from "vitest";
import {
  checkPublishReadiness,
  validateTransition,
  type WorkflowStateRef,
  type WorkflowTransitionRef,
} from "./index.js";

const states: WorkflowStateRef[] = [
  { id: "s1", code: "DRAFT", productStatus: "DRAFT", isInitial: true, isTerminal: false },
  { id: "s2", code: "IN_REVIEW", productStatus: "IN_REVIEW", isInitial: false, isTerminal: false },
  { id: "s3", code: "APPROVED", productStatus: "APPROVED", isInitial: false, isTerminal: false },
  { id: "s4", code: "PUBLISHED", productStatus: "PUBLISHED", isInitial: false, isTerminal: true },
  { id: "s5", code: "REJECTED", productStatus: "REJECTED", isInitial: false, isTerminal: false },
];

const transitions: WorkflowTransitionRef[] = [
  {
    id: "t1",
    fromStateId: "s1",
    toStateId: "s2",
    actionType: "SUBMIT",
    allowedRoles: ["EDITOR", "CATALOG_MANAGER"],
    requiresApproval: false,
    requiresJustification: false,
    isActive: true,
  },
  {
    id: "t2",
    fromStateId: "s2",
    toStateId: "s3",
    actionType: "APPROVE",
    allowedRoles: ["REVIEWER", "ADMIN"],
    requiresApproval: true,
    requiresJustification: false,
    isActive: true,
  },
  {
    id: "t3",
    fromStateId: "s2",
    toStateId: "s5",
    actionType: "REJECT",
    allowedRoles: ["REVIEWER", "ADMIN"],
    requiresApproval: true,
    requiresJustification: true,
    isActive: true,
  },
  {
    id: "t4",
    fromStateId: "s3",
    toStateId: "s4",
    actionType: "PUBLISH",
    allowedRoles: ["CATALOG_MANAGER", "ADMIN"],
    requiresApproval: false,
    requiresJustification: false,
    isActive: true,
  },
];

describe("workflow-engine", () => {
  it("allows valid submit and approve transitions", () => {
    const submit = validateTransition({
      transitions,
      states,
      currentStateId: "s1",
      actionType: "SUBMIT",
      actorRole: "EDITOR",
    });
    expect(submit.allowed).toBe(true);
    expect(submit.toState?.code).toBe("IN_REVIEW");

    const approve = validateTransition({
      transitions,
      states,
      currentStateId: "s2",
      actionType: "APPROVE",
      actorRole: "REVIEWER",
    });
    expect(approve.allowed).toBe(true);
    expect(approve.toState?.code).toBe("APPROVED");
  });

  it("blocks invalid transitions and missing rejection justification", () => {
    const invalid = validateTransition({
      transitions,
      states,
      currentStateId: "s1",
      actionType: "PUBLISH",
      actorRole: "ADMIN",
    });
    expect(invalid.allowed).toBe(false);

    const reject = validateTransition({
      transitions,
      states,
      currentStateId: "s2",
      actionType: "REJECT",
      actorRole: "REVIEWER",
    });
    expect(reject.allowed).toBe(false);
    expect(reject.reason).toContain("Justification");
  });

  it("blocks publish until product is approved", () => {
    const blocked = checkPublishReadiness({
      title: "Shirt",
      productType: "SIMPLE",
      primaryCategoryId: "cat-1",
      currentProductStatus: "DRAFT",
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers).toContain("Product must be approved before publishing");

    const ready = checkPublishReadiness({
      title: "Shirt",
      productType: "SIMPLE",
      primaryCategoryId: "cat-1",
      currentProductStatus: "APPROVED",
    });
    expect(ready.ready).toBe(true);
  });
});
