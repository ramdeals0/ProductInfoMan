import type { FacetRuleEntity, FacetRuleWorkflowState } from "@productinfoman/domain";
import type {
  CreateFacetRuleInput,
  UpdateFacetRuleInput,
} from "@productinfoman/validation";
import { validateFacetRuleConfig } from "@productinfoman/validation";
import { prisma } from "@productinfoman/db";
import { appError, recordChange } from "@productinfoman/shared";
import { createEvent } from "@productinfoman/contracts";
import { emitEvent } from "../../lib/events.js";
import type { Prisma } from "../../../../generated/prisma/client.js";

export type FacetWorkflowActor = {
  userId?: string;
};

const EDITABLE_STATES: FacetRuleWorkflowState[] = ["draft", "deprecated"];

function parseRuleConfig(
  value: Prisma.JsonValue,
): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function toFacetRuleDto(rule: {
  id: string;
  organizationId: string;
  categoryId: string | null;
  attributeDefinitionId: string | null;
  facetDefinitionId: string;
  ruleType: FacetRuleEntity["ruleType"];
  ruleConfig: Prisma.JsonValue;
  priority: number;
  workflowStateCode: string;
  createdBy: string | null;
  updatedBy: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  facetDefinition?: { key: string; label: string };
}): FacetRuleEntity {
  return {
    id: rule.id,
    organizationId: rule.organizationId,
    categoryId: rule.categoryId,
    attributeDefinitionId: rule.attributeDefinitionId,
    facetDefinitionId: rule.facetDefinitionId,
    facetKey: rule.facetDefinition?.key,
    facetLabel: rule.facetDefinition?.label,
    ruleType: rule.ruleType,
    ruleConfig: parseRuleConfig(rule.ruleConfig),
    priority: rule.priority,
    workflowStateCode: rule.workflowStateCode as FacetRuleWorkflowState,
    createdBy: rule.createdBy,
    updatedBy: rule.updatedBy,
    reviewedBy: rule.reviewedBy,
    reviewedAt: rule.reviewedAt?.toISOString() ?? null,
    notes: rule.notes,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

async function loadRule(ruleId: string, organizationId: string) {
  const rule = await prisma.facetRule.findFirst({
    where: { id: ruleId, organizationId },
    include: { facetDefinition: { select: { id: true, key: true, categoryId: true } } },
  });
  if (!rule) throw appError("Facet rule not found", 404);
  return rule;
}

async function assertFacetAndAttribute(
  organizationId: string,
  input: CreateFacetRuleInput,
): Promise<{ facet: { id: string; key: string; categoryId: string | null; sourceAttributeId: string }; attributeId: string }> {
  const facet = await prisma.facetDefinition.findFirst({
    where: { id: input.facetDefinitionId, organizationId },
  });
  if (!facet) throw appError("Facet definition not found", 404);

  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, organizationId },
    });
    if (!category) throw appError("Category not found", 404);
    if (facet.categoryId && facet.categoryId !== input.categoryId) {
      throw appError("Facet definition is scoped to a different category", 400);
    }
  }

  const attributeId = input.attributeDefinitionId ?? facet.sourceAttributeId;
  if (attributeId !== facet.sourceAttributeId) {
    throw appError("Facet rule attribute must match the facet source attribute", 400);
  }

  const attribute = await prisma.attributeDefinition.findFirst({
    where: { id: attributeId, organizationId },
  });
  if (!attribute) throw appError("Attribute not found", 400);

  return { facet, attributeId };
}

function validateRuleInput(
  ruleType: CreateFacetRuleInput["ruleType"],
  ruleConfig: Record<string, unknown> | null | undefined,
): void {
  try {
    validateFacetRuleConfig(ruleType, ruleConfig);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid facet rule configuration";
    throw appError(message, 400);
  }
}

async function auditFacetRuleAction(params: {
  organizationId: string;
  ruleId: string;
  action: "CREATE" | "UPDATE" | "STATE_CHANGE";
  actorId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  workflowAction?: string;
}): Promise<void> {
  await recordChange({
    organizationId: params.organizationId,
    entityType: "facet_rule",
    entityId: params.ruleId,
    action: params.action,
    performedBy: params.actorId,
    source: "workflow",
    before: params.before,
    after: params.after ?? (params.workflowAction ? { workflowAction: params.workflowAction } : undefined),
  });
}

async function emitFacetUpdated(
  organizationId: string,
  facetDefinitionId: string,
  key: string,
  categoryId: string | null,
): Promise<void> {
  await emitEvent(
    createEvent("taxonomy.facet.updated", organizationId, {
      facetDefinitionId,
      key,
      categoryId,
    }),
  );
}

export async function createFacetRule(
  organizationId: string,
  input: CreateFacetRuleInput,
  actor: FacetWorkflowActor,
): Promise<FacetRuleEntity> {
  const { facet, attributeId } = await assertFacetAndAttribute(organizationId, input);
  validateRuleInput(input.ruleType, input.ruleConfig ?? null);

  const rule = await prisma.facetRule.create({
    data: {
      organizationId,
      categoryId: input.categoryId ?? facet.categoryId,
      attributeDefinitionId: attributeId,
      facetDefinitionId: facet.id,
      ruleType: input.ruleType,
      ruleConfig: input.ruleConfig ?? undefined,
      priority: input.priority ?? 0,
      workflowStateCode: "draft",
      createdBy: actor.userId ?? null,
      updatedBy: actor.userId ?? null,
      notes: input.notes ?? null,
    },
  });

  await auditFacetRuleAction({
    organizationId,
    ruleId: rule.id,
    action: "CREATE",
    actorId: actor.userId,
    after: {
      ruleType: rule.ruleType,
      workflowStateCode: rule.workflowStateCode,
      ruleConfig: parseRuleConfig(rule.ruleConfig),
    },
    workflowAction: "create",
  });

  await emitFacetUpdated(organizationId, facet.id, facet.key, facet.categoryId);
  return toFacetRuleDto(rule);
}

export async function updateFacetRule(
  ruleId: string,
  organizationId: string,
  input: UpdateFacetRuleInput,
  actor: FacetWorkflowActor,
): Promise<FacetRuleEntity> {
  const existing = await loadRule(ruleId, organizationId);
  const state = existing.workflowStateCode as FacetRuleWorkflowState;
  if (!EDITABLE_STATES.includes(state)) {
    throw appError(`Facet rules in state '${state}' cannot be edited`, 400);
  }

  const nextRuleType = input.ruleType ?? existing.ruleType;
  const nextConfig =
    input.ruleConfig !== undefined ? input.ruleConfig : parseRuleConfig(existing.ruleConfig);
  validateRuleInput(nextRuleType, nextConfig);

  const before = {
    ruleType: existing.ruleType,
    ruleConfig: parseRuleConfig(existing.ruleConfig),
    priority: existing.priority,
    workflowStateCode: existing.workflowStateCode,
  };

  const rule = await prisma.facetRule.update({
    where: { id: ruleId },
    data: {
      ...(input.ruleType !== undefined && { ruleType: input.ruleType }),
      ...(input.ruleConfig !== undefined && { ruleConfig: input.ruleConfig ?? undefined }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedBy: actor.userId ?? null,
    },
  });

  await auditFacetRuleAction({
    organizationId,
    ruleId: rule.id,
    action: "UPDATE",
    actorId: actor.userId,
    before,
    after: {
      ruleType: rule.ruleType,
      ruleConfig: parseRuleConfig(rule.ruleConfig),
      priority: rule.priority,
      workflowStateCode: rule.workflowStateCode,
    },
    workflowAction: "update",
  });

  await emitFacetUpdated(
    organizationId,
    existing.facetDefinition.id,
    existing.facetDefinition.key,
    existing.facetDefinition.categoryId,
  );
  return toFacetRuleDto(rule);
}

async function transitionFacetRule(
  ruleId: string,
  organizationId: string,
  actor: FacetWorkflowActor,
  params: {
    fromStates: FacetRuleWorkflowState[];
    toState: FacetRuleWorkflowState;
    workflowAction: string;
    notes?: string;
    recordReview?: boolean;
  },
): Promise<FacetRuleEntity> {
  const existing = await loadRule(ruleId, organizationId);
  const currentState = existing.workflowStateCode as FacetRuleWorkflowState;
  if (!params.fromStates.includes(currentState)) {
    throw appError(
      `Cannot ${params.workflowAction} facet rule from state '${currentState}'`,
      400,
    );
  }

  const before = { workflowStateCode: currentState, notes: existing.notes };
  const rule = await prisma.facetRule.update({
    where: { id: ruleId },
    data: {
      workflowStateCode: params.toState,
      updatedBy: actor.userId ?? null,
      ...(params.recordReview
        ? {
            reviewedBy: actor.userId ?? null,
            reviewedAt: new Date(),
            ...(params.notes !== undefined ? { notes: params.notes } : {}),
          }
        : {}),
      ...(!params.recordReview && params.notes !== undefined ? { notes: params.notes } : {}),
    },
  });

  await auditFacetRuleAction({
    organizationId,
    ruleId: rule.id,
    action: "STATE_CHANGE",
    actorId: actor.userId,
    before,
    after: {
      workflowStateCode: rule.workflowStateCode,
      notes: rule.notes,
      workflowAction: params.workflowAction,
    },
    workflowAction: params.workflowAction,
  });

  await emitFacetUpdated(
    organizationId,
    existing.facetDefinition.id,
    existing.facetDefinition.key,
    existing.facetDefinition.categoryId,
  );
  return toFacetRuleDto(rule);
}

export async function submitFacetRule(
  ruleId: string,
  organizationId: string,
  actor: FacetWorkflowActor,
  notes?: string,
): Promise<FacetRuleEntity> {
  return transitionFacetRule(ruleId, organizationId, actor, {
    fromStates: ["draft"],
    toState: "in_review",
    workflowAction: "submit",
    notes,
  });
}

export async function approveFacetRule(
  ruleId: string,
  organizationId: string,
  actor: FacetWorkflowActor,
  notes?: string,
): Promise<FacetRuleEntity> {
  return transitionFacetRule(ruleId, organizationId, actor, {
    fromStates: ["in_review"],
    toState: "approved",
    workflowAction: "approve",
    notes,
    recordReview: true,
  });
}

export async function rejectFacetRule(
  ruleId: string,
  organizationId: string,
  actor: FacetWorkflowActor,
  notes?: string,
): Promise<FacetRuleEntity> {
  return transitionFacetRule(ruleId, organizationId, actor, {
    fromStates: ["in_review"],
    toState: "draft",
    workflowAction: "reject",
    notes,
    recordReview: true,
  });
}

export async function deprecateFacetRule(
  ruleId: string,
  organizationId: string,
  actor: FacetWorkflowActor,
  notes?: string,
): Promise<FacetRuleEntity> {
  return transitionFacetRule(ruleId, organizationId, actor, {
    fromStates: ["approved", "in_review"],
    toState: "deprecated",
    workflowAction: "deprecate",
    notes,
    recordReview: true,
  });
}

export async function cloneFacetRule(
  ruleId: string,
  organizationId: string,
  actor: FacetWorkflowActor,
): Promise<FacetRuleEntity> {
  const existing = await loadRule(ruleId, organizationId);
  if (existing.workflowStateCode !== "deprecated") {
    throw appError("Only deprecated facet rules can be cloned to a new draft", 400);
  }

  const rule = await prisma.facetRule.create({
    data: {
      organizationId,
      categoryId: existing.categoryId,
      attributeDefinitionId: existing.attributeDefinitionId,
      facetDefinitionId: existing.facetDefinitionId,
      ruleType: existing.ruleType,
      ruleConfig: existing.ruleConfig ?? undefined,
      priority: existing.priority,
      workflowStateCode: "draft",
      createdBy: actor.userId ?? null,
      updatedBy: actor.userId ?? null,
      notes: existing.notes,
    },
  });

  await auditFacetRuleAction({
    organizationId,
    ruleId: rule.id,
    action: "CREATE",
    actorId: actor.userId,
    after: {
      clonedFrom: existing.id,
      ruleType: rule.ruleType,
      workflowStateCode: rule.workflowStateCode,
    },
    workflowAction: "clone",
  });

  await emitFacetUpdated(
    organizationId,
    existing.facetDefinition.id,
    existing.facetDefinition.key,
    existing.facetDefinition.categoryId,
  );
  return toFacetRuleDto(rule);
}

export async function listFacetRules(
  organizationId: string,
  query: {
    categoryId?: string;
    facetDefinitionId?: string;
    state?: FacetRuleWorkflowState;
    approvedOnly?: boolean;
  } = {},
): Promise<FacetRuleEntity[]> {
  const rules = await prisma.facetRule.findMany({
    where: {
      organizationId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.facetDefinitionId ? { facetDefinitionId: query.facetDefinitionId } : {}),
      ...(query.state ? { workflowStateCode: query.state } : {}),
      ...(query.approvedOnly ? { workflowStateCode: "approved" } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      facetDefinition: { select: { key: true, label: true } },
    },
  });

  return rules.map(toFacetRuleDto);
}
