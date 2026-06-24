import type {
  WorkflowApprovalEntity,
  WorkflowDefinitionEntity,
  WorkflowHistoryEntity,
  WorkflowTaskEntity,
} from "@productinfoman/domain";
import type {
  CreateWorkflowDefinitionInput,
  WorkflowDecisionInput,
} from "@productinfoman/validation";
import { createEvent } from "@productinfoman/contracts";
import {
  checkPublishReadiness,
  resolveAssignmentRole,
  validateTransition,
  type WorkflowStateRef,
  type WorkflowTransitionRef,
} from "@productinfoman/workflow-engine";
import { prisma } from "@productinfoman/db";
import { appError, writeAudit } from "@productinfoman/shared";
import type { ProductStatus, UserRole } from "../../../../generated/prisma/client.js";
import { emitEvent } from "../../lib/events.js";
import { emitAuditRecordEvent } from "../../lib/audit-events.js";

type Actor = { userId?: string; role: UserRole };

async function getActiveWorkflowDefinition(organizationId: string, entityType: "PRODUCT" = "PRODUCT") {
  const definition = await prisma.workflowDefinition.findFirst({
    where: { organizationId, entityType, isActive: true },
    include: {
      states: { orderBy: { sortOrder: "asc" } },
      transitions: true,
      assignmentRules: { where: { isActive: true }, orderBy: { priority: "desc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!definition) {
    throw appError("No active workflow definition found", 404);
  }

  return definition;
}

function toStateRefs(states: Array<{ id: string; code: string; productStatus: ProductStatus; isInitial: boolean; isTerminal: boolean }>): WorkflowStateRef[] {
  return states.map((state) => ({
    id: state.id,
    code: state.code,
    productStatus: state.productStatus,
    isInitial: state.isInitial,
    isTerminal: state.isTerminal,
  }));
}

function toTransitionRefs(
  transitions: Array<{
    id: string;
    fromStateId: string;
    toStateId: string;
    actionType: string;
    allowedRoles: unknown;
    requiresApproval: boolean;
    requiresJustification: boolean;
    isActive: boolean;
  }>,
): WorkflowTransitionRef[] {
  return transitions.map((transition) => ({
    id: transition.id,
    fromStateId: transition.fromStateId,
    toStateId: transition.toStateId,
    actionType: transition.actionType,
    allowedRoles: Array.isArray(transition.allowedRoles)
      ? (transition.allowedRoles as string[])
      : [],
    requiresApproval: transition.requiresApproval,
    requiresJustification: transition.requiresJustification,
    isActive: transition.isActive,
  }));
}

function findStateForProductStatus(
  states: WorkflowStateRef[],
  productStatus: ProductStatus,
): WorkflowStateRef | undefined {
  return states.find((state) => state.productStatus === productStatus);
}

async function loadProduct(productId: string, organizationId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    include: { primaryCategory: { select: { code: true } } },
  });
  if (!product) throw appError("Product not found", 404);
  return product;
}

async function recordHistory(params: {
  organizationId: string;
  entityId: string;
  productId: string;
  fromState: string;
  toState: string;
  actionType: string;
  performedById?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.workflowHistory.create({
    data: {
      organizationId: params.organizationId,
      entityId: params.entityId,
      entityType: "PRODUCT",
      productId: params.productId,
      fromState: params.fromState,
      toState: params.toState,
      actionType: params.actionType,
      performedById: params.performedById,
      metadata: params.metadata,
    },
  });
}

async function executeTransition(params: {
  organizationId: string;
  productId: string;
  actionType: string;
  actor: Actor;
  justification?: string;
  comments?: string;
  decision?: "APPROVED" | "REJECTED";
  extraMetadata?: Record<string, unknown>;
}) {
  const [product, definition] = await Promise.all([
    loadProduct(params.productId, params.organizationId),
    getActiveWorkflowDefinition(params.organizationId),
  ]);

  const states = toStateRefs(definition.states);
  const transitions = toTransitionRefs(definition.transitions);
  const currentState = findStateForProductStatus(states, product.status);
  if (!currentState) {
    throw appError(`No workflow state mapped for product status ${product.status}`, 400);
  }

  const validation = validateTransition({
    transitions,
    states,
    currentStateId: currentState.id,
    actionType: params.actionType,
    actorRole: params.actor.role,
    justification: params.justification,
  });

  if (!validation.allowed || !validation.toState) {
    throw appError(validation.reason ?? "Transition not allowed", 400);
  }

  if (params.actionType === "PUBLISH") {
    const readiness = checkPublishReadiness({
      title: product.title,
      productType: product.productType,
      primaryCategoryId: product.primaryCategoryId,
      currentProductStatus: product.status,
    });
    if (!readiness.ready) {
      throw appError(`Publish blocked: ${readiness.blockers.join("; ")}`, 400);
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id: product.id },
    data: { status: validation.toState.productStatus as ProductStatus },
  });

  await recordHistory({
    organizationId: params.organizationId,
    entityId: product.id,
    productId: product.id,
    fromState: currentState.code,
    toState: validation.toState.code,
    actionType: params.actionType,
    performedById: params.actor.userId,
    metadata: {
      ...(params.justification ? { justification: params.justification } : {}),
      ...(params.comments ? { comments: params.comments } : {}),
      ...params.extraMetadata,
    },
  });

  const auditLogId = await writeAudit({
    organizationId: params.organizationId,
    entityType: "Product",
    entityId: product.id,
    productId: product.id,
    action: "STATE_CHANGE",
    actorId: params.actor.userId,
    changes: {
      actionType: params.actionType,
      fromState: currentState.code,
      toState: validation.toState.code,
      status: updatedProduct.status,
    },
  });

  await emitAuditRecordEvent({
    organizationId: params.organizationId,
    auditLogId,
    entityType: "Product",
    entityId: product.id,
    action: "STATE_CHANGE",
    productId: product.id,
  });

  if (params.actionType === "SUBMIT") {
    const assignRole =
      resolveAssignmentRole(
        definition.assignmentRules.map((rule) => ({
          assignToRole: rule.assignToRole,
          productTypes: rule.productTypes as string[] | null,
          categoryCodes: rule.categoryCodes as string[] | null,
          priority: rule.priority,
          isActive: rule.isActive,
        })),
        product.productType,
        product.primaryCategory?.code ?? null,
      ) ?? "REVIEWER";

    await prisma.workflowTask.updateMany({
      where: {
        organizationId: params.organizationId,
        entityId: product.id,
        status: "OPEN",
      },
      data: { status: "CANCELLED", completedAt: new Date() },
    });

    await prisma.workflowTask.create({
      data: {
        organizationId: params.organizationId,
        workflowDefinitionId: definition.id,
        workflowStateId: validation.toState.id,
        entityType: "PRODUCT",
        entityId: product.id,
        productId: product.id,
        assignedRole: assignRole as UserRole,
        status: "OPEN",
        actionType: "REVIEW",
      },
    });
  }

  if (params.actionType === "APPROVE" || params.actionType === "REJECT") {
    const openTask = await prisma.workflowTask.findFirst({
      where: {
        organizationId: params.organizationId,
        entityId: product.id,
        status: "OPEN",
      },
      orderBy: { createdAt: "desc" },
    });

    if (openTask) {
      if (!params.actor.userId) {
        throw appError("Approver user identity is required", 401);
      }

      await prisma.workflowApproval.create({
        data: {
          workflowTaskId: openTask.id,
          approverUserId: params.actor.userId,
          decision: params.actionType === "APPROVE" ? "APPROVED" : "REJECTED",
          decisionReason: params.justification,
          comments: params.comments,
        },
      });

      await emitEvent(
        createEvent("workflow.approval.recorded", params.organizationId, {
          productId: product.id,
          workflowTaskId: openTask.id,
          decision: params.actionType === "APPROVE" ? "APPROVED" : "REJECTED",
          approverUserId: params.actor.userId,
        }),
      );

      await prisma.workflowTask.update({
        where: { id: openTask.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }
  }

  if (params.actionType === "PUBLISH") {
    await prisma.workflowTask.updateMany({
      where: {
        organizationId: params.organizationId,
        entityId: product.id,
        status: "OPEN",
      },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  await emitEvent(
    createEvent("workflow.state.changed", params.organizationId, {
      productId: product.id,
      fromState: currentState.code,
      toState: validation.toState.code,
      fromStatus: product.status,
      toStatus: updatedProduct.status,
      actionType: params.actionType,
    }),
  );

  return {
    productId: product.id,
    sku: product.sku,
    fromState: currentState.code,
    toState: validation.toState.code,
    status: updatedProduct.status,
  };
}

export async function createWorkflowDefinition(
  organizationId: string,
  input: CreateWorkflowDefinitionInput,
): Promise<WorkflowDefinitionEntity> {
  const existing = await prisma.workflowDefinition.findFirst({
    where: { organizationId, code: input.code },
    select: { id: true },
  });
  if (existing) throw appError(`Workflow definition code already exists: ${input.code}`, 409);

  if (input.isActive) {
    await prisma.workflowDefinition.updateMany({
      where: { organizationId, entityType: input.entityType ?? "PRODUCT", isActive: true },
      data: { isActive: false },
    });
  }

  const definition = await prisma.workflowDefinition.create({
    data: {
      organizationId,
      code: input.code,
      name: input.name,
      entityType: input.entityType ?? "PRODUCT",
      isActive: input.isActive ?? true,
      states: {
        create: input.states.map((state, index) => ({
          code: state.code,
          name: state.name,
          productStatus: state.productStatus,
          isInitial: state.isInitial ?? false,
          isTerminal: state.isTerminal ?? false,
          sortOrder: state.sortOrder ?? index,
        })),
      },
    },
    include: { states: { orderBy: { sortOrder: "asc" } } },
  });

  const stateByCode = new Map(definition.states.map((state) => [state.code, state.id]));

  if (input.transitions?.length) {
    await prisma.workflowTransition.createMany({
      data: input.transitions.map((transition) => ({
        workflowDefinitionId: definition.id,
        fromStateId: stateByCode.get(transition.fromStateCode)!,
        toStateId: stateByCode.get(transition.toStateCode)!,
        actionType: transition.actionType,
        allowedRoles: transition.allowedRoles,
        requiresApproval: transition.requiresApproval ?? false,
        requiresJustification: transition.requiresJustification ?? false,
        isActive: true,
      })),
    });
  }

  if (input.assignmentRules?.length) {
    await prisma.workflowAssignmentRule.createMany({
      data: input.assignmentRules.map((rule) => ({
        workflowDefinitionId: definition.id,
        name: rule.name,
        assignToRole: rule.assignToRole,
        productTypes: rule.productTypes,
        categoryCodes: rule.categoryCodes,
        priority: rule.priority ?? 0,
        isActive: true,
      })),
    });
  }

  return getWorkflowDefinition(definition.id, organizationId);
}

export async function listWorkflowDefinitions(
  organizationId: string,
): Promise<WorkflowDefinitionEntity[]> {
  const definitions = await prisma.workflowDefinition.findMany({
    where: { organizationId },
    include: {
      states: { orderBy: { sortOrder: "asc" } },
      transitions: true,
      assignmentRules: true,
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return definitions.map(mapWorkflowDefinition);
}

export async function getWorkflowDefinition(
  id: string,
  organizationId: string,
): Promise<WorkflowDefinitionEntity> {
  const definition = await prisma.workflowDefinition.findFirst({
    where: { id, organizationId },
    include: {
      states: { orderBy: { sortOrder: "asc" } },
      transitions: true,
      assignmentRules: true,
    },
  });
  if (!definition) throw appError("Workflow definition not found", 404);
  return mapWorkflowDefinition(definition);
}

function mapWorkflowDefinition(definition: {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  entityType: WorkflowDefinitionEntity["entityType"];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  states: Array<{
    id: string;
    code: string;
    name: string;
    productStatus: ProductStatus;
    isInitial: boolean;
    isTerminal: boolean;
    sortOrder: number;
  }>;
  transitions: Array<{
    id: string;
    fromStateId: string;
    toStateId: string;
    actionType: string;
    allowedRoles: unknown;
    requiresApproval: boolean;
    requiresJustification: boolean;
    isActive: boolean;
  }>;
  assignmentRules: Array<{
    id: string;
    name: string;
    assignToRole: UserRole;
    productTypes: unknown;
    categoryCodes: unknown;
    priority: number;
    isActive: boolean;
  }>;
}): WorkflowDefinitionEntity {
  const stateCodeById = new Map(definition.states.map((state) => [state.id, state.code]));

  return {
    id: definition.id,
    organizationId: definition.organizationId,
    code: definition.code,
    name: definition.name,
    entityType: definition.entityType,
    isActive: definition.isActive,
    states: definition.states.map((state) => ({
      id: state.id,
      code: state.code,
      name: state.name,
      productStatus: state.productStatus,
      isInitial: state.isInitial,
      isTerminal: state.isTerminal,
      sortOrder: state.sortOrder,
    })),
    transitions: definition.transitions.map((transition) => ({
      id: transition.id,
      fromStateCode: stateCodeById.get(transition.fromStateId) ?? "",
      toStateCode: stateCodeById.get(transition.toStateId) ?? "",
      actionType: transition.actionType,
      allowedRoles: Array.isArray(transition.allowedRoles)
        ? (transition.allowedRoles as string[])
        : [],
      requiresApproval: transition.requiresApproval,
      requiresJustification: transition.requiresJustification,
      isActive: transition.isActive,
    })),
    assignmentRules: definition.assignmentRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      assignToRole: rule.assignToRole,
      productTypes: (rule.productTypes as string[] | null) ?? null,
      categoryCodes: (rule.categoryCodes as string[] | null) ?? null,
      priority: rule.priority,
      isActive: rule.isActive,
    })),
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  };
}

export async function submitProduct(
  productId: string,
  organizationId: string,
  actor: Actor,
  input: WorkflowDecisionInput = {},
) {
  return executeTransition({
    organizationId,
    productId,
    actionType: "SUBMIT",
    actor,
    comments: input.comments,
  });
}

export async function approveProduct(
  productId: string,
  organizationId: string,
  actor: Actor,
  input: WorkflowDecisionInput = {},
) {
  return executeTransition({
    organizationId,
    productId,
    actionType: "APPROVE",
    actor,
    justification: input.reason,
    comments: input.comments,
  });
}

export async function rejectProduct(
  productId: string,
  organizationId: string,
  actor: Actor,
  input: WorkflowDecisionInput,
) {
  return executeTransition({
    organizationId,
    productId,
    actionType: "REJECT",
    actor,
    justification: input.reason,
    comments: input.comments,
  });
}

export async function publishProduct(
  productId: string,
  organizationId: string,
  actor: Actor,
  input: WorkflowDecisionInput = {},
) {
  return executeTransition({
    organizationId,
    productId,
    actionType: "PUBLISH",
    actor,
    comments: input.comments,
  });
}

export async function getProductWorkflowHistory(
  productId: string,
  organizationId: string,
): Promise<WorkflowHistoryEntity[]> {
  await loadProduct(productId, organizationId);

  const history = await prisma.workflowHistory.findMany({
    where: { organizationId, entityType: "PRODUCT", entityId: productId },
    orderBy: { performedAt: "desc" },
  });

  return history.map((entry) => ({
    id: entry.id,
    organizationId: entry.organizationId,
    entityId: entry.entityId,
    entityType: entry.entityType,
    productId: entry.productId,
    fromState: entry.fromState,
    toState: entry.toState,
    actionType: entry.actionType,
    performedById: entry.performedById,
    performedAt: entry.performedAt.toISOString(),
    metadata: entry.metadata as Record<string, unknown> | null,
  }));
}

export async function listWorkflowTasks(
  organizationId: string,
  filters: { status?: "OPEN" | "COMPLETED" | "CANCELLED"; assignedRole?: UserRole } = {},
): Promise<WorkflowTaskEntity[]> {
  const tasks = await prisma.workflowTask.findMany({
    where: {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assignedRole ? { assignedRole: filters.assignedRole } : {}),
    },
    include: {
      workflowState: true,
      approvals: { include: { approver: true }, orderBy: { decidedAt: "desc" } },
      product: { select: { sku: true, title: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map(mapWorkflowTask);
}

export async function getWorkflowTask(
  taskId: string,
  organizationId: string,
): Promise<WorkflowTaskEntity> {
  const task = await prisma.workflowTask.findFirst({
    where: { id: taskId, organizationId },
    include: {
      workflowState: true,
      approvals: { include: { approver: true }, orderBy: { decidedAt: "desc" } },
      product: { select: { sku: true, title: true, status: true } },
    },
  });
  if (!task) throw appError("Workflow task not found", 404);
  return mapWorkflowTask(task);
}

function mapWorkflowTask(task: {
  id: string;
  organizationId: string;
  workflowDefinitionId: string;
  workflowStateId: string;
  entityType: WorkflowTaskEntity["entityType"];
  entityId: string;
  productId: string | null;
  assignedRole: UserRole | null;
  assignedUserId: string | null;
  status: WorkflowTaskEntity["status"];
  actionType: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  workflowState: { code: string; name: string };
  product: { sku: string; title: string; status: ProductStatus } | null;
  approvals: Array<{
    id: string;
    approverUserId: string;
    decision: WorkflowApprovalEntity["decision"];
    decisionReason: string | null;
    comments: string | null;
    decidedAt: Date;
    approver: { email: string; name: string };
  }>;
}): WorkflowTaskEntity {
  return {
    id: task.id,
    organizationId: task.organizationId,
    workflowDefinitionId: task.workflowDefinitionId,
    workflowStateCode: task.workflowState.code,
    entityType: task.entityType,
    entityId: task.entityId,
    productId: task.productId,
    productSku: task.product?.sku ?? null,
    productTitle: task.product?.title ?? null,
    productStatus: task.product?.status ?? null,
    assignedRole: task.assignedRole,
    assignedUserId: task.assignedUserId,
    status: task.status,
    actionType: task.actionType,
    approvals: task.approvals.map((approval) => ({
      id: approval.id,
      approverUserId: approval.approverUserId,
      approverEmail: approval.approver.email,
      approverName: approval.approver.name,
      decision: approval.decision,
      decisionReason: approval.decisionReason,
      comments: approval.comments,
      decidedAt: approval.decidedAt.toISOString(),
    })),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  };
}
