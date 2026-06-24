export type WorkflowActionType = "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH" | "RESUBMIT";

export interface WorkflowStateRef {
  id: string;
  code: string;
  productStatus: string;
  isInitial: boolean;
  isTerminal: boolean;
}

export interface WorkflowTransitionRef {
  id: string;
  fromStateId: string;
  toStateId: string;
  actionType: string;
  allowedRoles: string[];
  requiresApproval: boolean;
  requiresJustification: boolean;
  isActive: boolean;
}

export interface TransitionValidationInput {
  transitions: WorkflowTransitionRef[];
  states: WorkflowStateRef[];
  currentStateId: string;
  actionType: string;
  actorRole: string;
  justification?: string;
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
  transition?: WorkflowTransitionRef;
  fromState?: WorkflowStateRef;
  toState?: WorkflowStateRef;
}

export interface PublishReadinessInput {
  title: string;
  productType: string;
  primaryCategoryId: string | null;
  currentProductStatus: string;
}

export interface PublishReadinessResult {
  ready: boolean;
  blockers: string[];
}

export function findTransition(
  transitions: WorkflowTransitionRef[],
  fromStateId: string,
  actionType: string,
): WorkflowTransitionRef | undefined {
  return transitions.find(
    (transition) =>
      transition.isActive &&
      transition.fromStateId === fromStateId &&
      transition.actionType === actionType,
  );
}

export function validateTransition(
  input: TransitionValidationInput,
): TransitionValidationResult {
  const fromState = input.states.find((state) => state.id === input.currentStateId);
  if (!fromState) {
    return { allowed: false, reason: "Current workflow state not found" };
  }

  const transition = findTransition(input.transitions, input.currentStateId, input.actionType);
  if (!transition) {
    return {
      allowed: false,
      reason: `Transition ${input.actionType} is not allowed from state ${fromState.code}`,
      fromState,
    };
  }

  if (!transition.allowedRoles.includes(input.actorRole)) {
    return {
      allowed: false,
      reason: `Role ${input.actorRole} is not allowed to perform ${input.actionType}`,
      fromState,
      transition,
    };
  }

  if (transition.requiresJustification && !input.justification?.trim()) {
    return {
      allowed: false,
      reason: `Justification is required for ${input.actionType}`,
      fromState,
      transition,
    };
  }

  const toState = input.states.find((state) => state.id === transition.toStateId);
  if (!toState) {
    return { allowed: false, reason: "Target workflow state not found", fromState, transition };
  }

  return { allowed: true, transition, fromState, toState };
}

export function checkPublishReadiness(input: PublishReadinessInput): PublishReadinessResult {
  const blockers: string[] = [];

  if (!input.title?.trim()) {
    blockers.push("Product title is required");
  }

  if (!["APPROVED", "PUBLISH_READY"].includes(input.currentProductStatus)) {
    blockers.push("Product must be approved before publishing");
  }

  if (input.productType === "VARIANT" && !input.primaryCategoryId) {
    blockers.push("Variant products should have a primary category before publishing");
  }

  return {
    ready: blockers.length === 0,
    blockers,
  };
}

export function resolveAssignmentRole(
  rules: Array<{
    assignToRole: string;
    productTypes?: string[] | null;
    categoryCodes?: string[] | null;
    priority: number;
    isActive: boolean;
  }>,
  productType: string,
  categoryCode: string | null,
): string | null {
  const matches = rules
    .filter((rule) => rule.isActive)
    .filter((rule) => {
      const typeMatch =
        !rule.productTypes?.length || rule.productTypes.includes(productType);
      const categoryMatch =
        !rule.categoryCodes?.length ||
        (categoryCode ? rule.categoryCodes.includes(categoryCode) : false);
      return typeMatch && categoryMatch;
    })
    .sort((a, b) => b.priority - a.priority);

  return matches[0]?.assignToRole ?? null;
}
