import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createProduct } from "../modules/product-core/product.service.js";
import {
  approveProduct,
  getProductWorkflowHistory,
  getWorkflowTask,
  listWorkflowTasks,
  publishProduct,
  rejectProduct,
  submitProduct,
} from "../modules/workflow/workflow.service.js";
import { prisma } from "@productinfoman/db";

const ORG_SLUG = "demo";
let organizationId: string;
let editorUserId: string;
let reviewerUserId: string;
let catalogManagerUserId: string;

beforeAll(async () => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;

  const editor = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "editor@demo.local" } },
    create: {
      organizationId,
      email: "editor@demo.local",
      name: "Demo Editor",
      role: "EDITOR",
    },
    update: { role: "EDITOR" },
  });
  editorUserId = editor.id;

  const reviewer = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "reviewer@demo.local" } },
    create: {
      organizationId,
      email: "reviewer@demo.local",
      name: "Demo Reviewer",
      role: "REVIEWER",
    },
    update: { role: "REVIEWER" },
  });
  reviewerUserId = reviewer.id;

  const catalogManager = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "catalog@demo.local" } },
    create: {
      organizationId,
      email: "catalog@demo.local",
      name: "Demo Catalog Manager",
      role: "CATALOG_MANAGER",
    },
    update: { role: "CATALOG_MANAGER" },
  });
  catalogManagerUserId = catalogManager.id;

  const workflow = await prisma.workflowDefinition.upsert({
    where: { organizationId_code: { organizationId, code: "test-product-lifecycle" } },
    create: {
      organizationId,
      code: "test-product-lifecycle",
      name: "Test Product Lifecycle",
      entityType: "PRODUCT",
      isActive: true,
    },
    update: { isActive: true },
  });

  await prisma.workflowDefinition.updateMany({
    where: {
      organizationId,
      entityType: "PRODUCT",
      NOT: { id: workflow.id },
    },
    data: { isActive: false },
  });

  const states = [
    { code: "DRAFT", name: "Draft", productStatus: "DRAFT" as const, isInitial: true, isTerminal: false, sortOrder: 0 },
    { code: "IN_REVIEW", name: "In Review", productStatus: "IN_REVIEW" as const, isInitial: false, isTerminal: false, sortOrder: 1 },
    { code: "APPROVED", name: "Approved", productStatus: "APPROVED" as const, isInitial: false, isTerminal: false, sortOrder: 2 },
    { code: "PUBLISHED", name: "Published", productStatus: "PUBLISHED" as const, isInitial: false, isTerminal: true, sortOrder: 3 },
    { code: "REJECTED", name: "Rejected", productStatus: "REJECTED" as const, isInitial: false, isTerminal: false, sortOrder: 4 },
  ];

  const stateIds = new Map<string, string>();
  for (const state of states) {
    const record = await prisma.workflowState.upsert({
      where: {
        workflowDefinitionId_code: { workflowDefinitionId: workflow.id, code: state.code },
      },
      create: { workflowDefinitionId: workflow.id, ...state },
      update: state,
    });
    stateIds.set(state.code, record.id);
  }

  const transitions = [
    ["DRAFT", "IN_REVIEW", "SUBMIT", ["EDITOR", "CATALOG_MANAGER"], false, false],
    ["IN_REVIEW", "APPROVED", "APPROVE", ["REVIEWER", "ADMIN"], true, false],
    ["IN_REVIEW", "REJECTED", "REJECT", ["REVIEWER", "ADMIN"], true, true],
    ["APPROVED", "PUBLISHED", "PUBLISH", ["CATALOG_MANAGER", "ADMIN"], false, false],
  ] as const;

  for (const [from, to, actionType, allowedRoles, requiresApproval, requiresJustification] of transitions) {
    const fromStateId = stateIds.get(from)!;
    const toStateId = stateIds.get(to)!;
    const existing = await prisma.workflowTransition.findFirst({
      where: { workflowDefinitionId: workflow.id, fromStateId, actionType },
    });
    if (!existing) {
      await prisma.workflowTransition.create({
        data: {
          workflowDefinitionId: workflow.id,
          fromStateId,
          toStateId,
          actionType,
          allowedRoles,
          requiresApproval,
          requiresJustification,
        },
      });
    }
  }

  const existingRule = await prisma.workflowAssignmentRule.findFirst({
    where: { workflowDefinitionId: workflow.id, name: "Default reviewer routing" },
  });
  if (!existingRule) {
    await prisma.workflowAssignmentRule.create({
      data: {
        workflowDefinitionId: workflow.id,
        name: "Default reviewer routing",
        assignToRole: "REVIEWER",
        priority: 0,
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const editor = () => ({ userId: editorUserId, role: "EDITOR" as const });
const reviewer = () => ({ userId: reviewerUserId, role: "REVIEWER" as const });
const catalogManager = () => ({ userId: catalogManagerUserId, role: "CATALOG_MANAGER" as const });

describe("Workflow and Approval", () => {
  // Phase 4 spec §9: Initial workflow state on product creation (draft).
  it("creates products in draft status", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `WF-DRAFT-${ts}`,
      title: "Draft Product",
    });
    expect(product.status).toBe("DRAFT");
  });

  // Phase 4 spec §9: submitForReview only allowed from draft/rejected.
  it("allows submit from draft and blocks submit from in_review", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `WF-SUBMIT-${ts}`,
      title: "Submit Product",
    });

    const submitted = await submitProduct(product.id, organizationId, editor());
    expect(submitted.toState).toBe("IN_REVIEW");

    await expect(submitProduct(product.id, organizationId, editor())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  // Phase 4 spec §9: approveProduct only allowed from in_review.
  it("allows approve only from in_review", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `WF-APPROVE-${ts}`,
      title: "Approve Product",
    });

    await expect(
      approveProduct(product.id, organizationId, reviewer(), { reason: "Too early" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await submitProduct(product.id, organizationId, editor());
    const approved = await approveProduct(product.id, organizationId, reviewer(), {
      reason: "Looks good",
    });
    expect(approved.toState).toBe("APPROVED");
  });

  // Phase 4 spec §9: rejectProduct only allowed from in_review.
  it("allows reject only from in_review and requires reason when configured", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `WF-REJECT-${ts}`,
      title: "Reject Product",
    });

    await expect(
      rejectProduct(product.id, organizationId, reviewer(), { reason: "Not in review" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await submitProduct(product.id, organizationId, editor());

    await expect(
      rejectProduct(product.id, organizationId, reviewer(), { reason: "" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    const rejected = await rejectProduct(product.id, organizationId, reviewer(), {
      reason: "Missing required attributes",
      comments: "Add brand before resubmitting",
    });
    expect(rejected.toState).toBe("REJECTED");
  });

  // Phase 4 spec §9: publishProduct only allowed from approved.
  it("allows publish only from approved", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `WF-PUBLISH-${ts}`,
      title: "Publish Product",
    });

    await expect(publishProduct(product.id, organizationId, catalogManager())).rejects.toMatchObject({
      statusCode: 400,
    });

    await submitProduct(product.id, organizationId, editor());
    await expect(publishProduct(product.id, organizationId, catalogManager())).rejects.toMatchObject({
      statusCode: 400,
    });

    await approveProduct(product.id, organizationId, reviewer(), { reason: "Approved" });
    const published = await publishProduct(product.id, organizationId, catalogManager());
    expect(published.toState).toBe("PUBLISHED");
  });

  // Phase 4 spec §9: Attempts to skip states (draft -> published) are blocked.
  it("blocks role violations and skipped transitions", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `WF-BLOCK-${ts}`,
      title: "Blocked Product",
    });

    await expect(publishProduct(product.id, organizationId, catalogManager())).rejects.toMatchObject({
      statusCode: 400,
    });

    await submitProduct(product.id, organizationId, editor());

    await expect(
      approveProduct(product.id, organizationId, editor(), { reason: "Wrong role" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // Phase 4 spec §9: workflow_history entries created for each transition.
  it("records workflow history and approval metadata through the full lifecycle", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `WF-HIST-${ts}`,
      title: "History Product",
    });

    await submitProduct(product.id, organizationId, editor());
    await approveProduct(product.id, organizationId, reviewer(), {
      reason: "Meets catalog standards",
    });
    await publishProduct(product.id, organizationId, catalogManager());

    const history = await getProductWorkflowHistory(product.id, organizationId);
    expect(history.map((entry) => entry.actionType)).toEqual(
      expect.arrayContaining(["SUBMIT", "APPROVE", "PUBLISH"]),
    );

    const tasks = await listWorkflowTasks(organizationId, { status: "COMPLETED" });
    const task = tasks.find((item) => item.productId === product.id);
    expect(task).toBeDefined();

    if (task) {
      const fetchedTask = await getWorkflowTask(task.id, organizationId);
      expect(fetchedTask.approvals[0]?.decision).toBe("APPROVED");
      expect(fetchedTask.approvals[0]?.decisionReason).toBe("Meets catalog standards");
    }
  });
});
