import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@productinfoman/db";
import { createProduct, updateProduct } from "../modules/product-core/product.service.js";
import {
  approveProduct,
  submitProduct,
} from "../modules/workflow/workflow.service.js";
import { listAuditLogs, getEntityChangeHistory } from "../modules/audit/audit.service.js";
import {
  computeDashboard,
  computeCompletenessReport,
  resolveReportPeriod,
} from "../modules/reports/reports.service.js";

const ORG_SLUG = "demo";
let organizationId: string;
let editorUserId: string;
let reviewerUserId: string;
let shirtsCategoryId: string;

beforeAll(async () => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;

  const editor = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "audit-editor@demo.local" } },
    create: {
      organizationId,
      email: "audit-editor@demo.local",
      name: "Audit Editor",
      role: "EDITOR",
    },
    update: { role: "EDITOR" },
  });
  editorUserId = editor.id;

  const reviewer = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "audit-reviewer@demo.local" } },
    create: {
      organizationId,
      email: "audit-reviewer@demo.local",
      name: "Audit Reviewer",
      role: "REVIEWER",
    },
    update: { role: "REVIEWER" },
  });
  reviewerUserId = reviewer.id;

  const shirts = await prisma.category.findFirst({
    where: { organizationId, code: "shirts" },
  });
  if (!shirts) throw new Error("Seed category shirts is required");
  shirtsCategoryId = shirts.id;

  const workflow = await prisma.workflowDefinition.upsert({
    where: { organizationId_code: { organizationId, code: "audit-test-lifecycle" } },
    create: {
      organizationId,
      code: "audit-test-lifecycle",
      name: "Audit Test Lifecycle",
      entityType: "PRODUCT",
      isActive: true,
    },
    update: { isActive: true },
  });

  await prisma.workflowDefinition.updateMany({
    where: { organizationId, entityType: "PRODUCT", NOT: { id: workflow.id } },
    data: { isActive: false },
  });

  const states = [
    { code: "DRAFT", name: "Draft", productStatus: "DRAFT" as const, isInitial: true, isTerminal: false, sortOrder: 0 },
    { code: "IN_REVIEW", name: "In Review", productStatus: "IN_REVIEW" as const, isInitial: false, isTerminal: false, sortOrder: 1 },
    { code: "APPROVED", name: "Approved", productStatus: "APPROVED" as const, isInitial: false, isTerminal: false, sortOrder: 2 },
    { code: "PUBLISHED", name: "Published", productStatus: "PUBLISHED" as const, isInitial: false, isTerminal: true, sortOrder: 3 },
  ];

  const stateIds = new Map<string, string>();
  for (const state of states) {
    const record = await prisma.workflowState.upsert({
      where: { workflowDefinitionId_code: { workflowDefinitionId: workflow.id, code: state.code } },
      create: { workflowDefinitionId: workflow.id, ...state },
      update: state,
    });
    stateIds.set(state.code, record.id);
  }

  const transitions = [
    { from: "DRAFT", to: "IN_REVIEW", actionType: "SUBMIT", allowedRoles: ["EDITOR"] },
    { from: "IN_REVIEW", to: "APPROVED", actionType: "APPROVE", allowedRoles: ["REVIEWER"] },
  ];

  for (const transition of transitions) {
    const existing = await prisma.workflowTransition.findFirst({
      where: {
        workflowDefinitionId: workflow.id,
        fromStateId: stateIds.get(transition.from)!,
        toStateId: stateIds.get(transition.to)!,
        actionType: transition.actionType,
      },
    });
    if (!existing) {
      await prisma.workflowTransition.create({
        data: {
          workflowDefinitionId: workflow.id,
          fromStateId: stateIds.get(transition.from)!,
          toStateId: stateIds.get(transition.to)!,
          actionType: transition.actionType,
          allowedRoles: transition.allowedRoles,
        },
      });
    }
  }
});

describe("audit and reporting service", () => {
  // Phase 7 spec §7: Audit logs created on product create/update.
  it("creates audit logs on product create and update", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `AUDIT-CREATE-${ts}`,
      title: "Audit Create Product",
      primaryCategoryId: shirtsCategoryId,
    });

    const createLogs = await listAuditLogs(organizationId, {
      entityType: "Product",
      entityId: product.id,
      action: "CREATE",
      page: 1,
      pageSize: 10,
    });
    expect(createLogs.total).toBeGreaterThan(0);
    expect(createLogs.items[0]?.after?.sku).toBe(product.sku);
    expect(createLogs.items[0]?.source).toBe("api");

    await updateProduct(product.id, organizationId, { title: "Audit Updated Title" });

    const updateLogs = await listAuditLogs(organizationId, {
      entityType: "Product",
      entityId: product.id,
      action: "UPDATE",
      page: 1,
      pageSize: 10,
    });
    expect(updateLogs.total).toBeGreaterThan(0);
    expect(updateLogs.items[0]?.before?.title).toBe("Audit Create Product");
    expect(updateLogs.items[0]?.after?.title).toBe("Audit Updated Title");
    expect(updateLogs.items[0]?.changedFields?.title).toBeDefined();
  });

  // Phase 7 spec §7: Audit logs created on workflow transitions.
  it("creates audit logs on workflow transitions", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `AUDIT-WF-${ts}`,
      title: "Audit Workflow Product",
      primaryCategoryId: shirtsCategoryId,
    });

    await submitProduct(product.id, organizationId, { userId: editorUserId, role: "EDITOR" });
    await approveProduct(product.id, organizationId, { userId: reviewerUserId, role: "REVIEWER" });

    const logs = await listAuditLogs(organizationId, {
      entityType: "Product",
      entityId: product.id,
      action: "STATE_CHANGE",
      page: 1,
      pageSize: 20,
    });

    expect(logs.total).toBeGreaterThanOrEqual(2);
    expect(logs.items.some((log) => log.source === "workflow")).toBe(true);
    expect(logs.items.some((log) => log.after && (log.after as { state?: string }).state === "APPROVED")).toBe(true);
  });

  // Phase 7 spec §7: History snapshots versioned correctly.
  it("versions entity change history snapshots", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `AUDIT-HIST-${ts}`,
      title: "History Snapshot Product",
      primaryCategoryId: shirtsCategoryId,
    });

    await updateProduct(product.id, organizationId, { brand: "Audit Brand" });

    const history = await getEntityChangeHistory(organizationId, "Product", product.id);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0]?.versionNumber).toBe(1);
    expect(history[0]?.changeType).toBe("CREATE");
    expect(history[history.length - 1]?.versionNumber).toBeGreaterThan(1);
    expect(history[history.length - 1]?.snapshot.title).toBe("History Snapshot Product");
  });

  // Phase 7 spec §7: Dashboard report returns basic aggregated metrics.
  it("returns dashboard report with aggregated metrics", async () => {
    const period = resolveReportPeriod();
    const dashboard = await computeDashboard(organizationId, period);

    expect(dashboard.totalProducts).toBeGreaterThan(0);
    expect(dashboard.periodStart).toBeDefined();
    expect(dashboard.periodEnd).toBeDefined();
    expect(dashboard.imports.totalJobs).toBeGreaterThanOrEqual(0);
    expect(dashboard.publishing.totalJobs).toBeGreaterThanOrEqual(0);
    expect(dashboard.averageCompletenessScore).toBeGreaterThanOrEqual(0);
    expect(dashboard.averageCompletenessScore).toBeLessThanOrEqual(100);
  });

  // Phase 7 spec §7: Completeness report returns plausible scores.
  it("returns completeness report with plausible scores", async () => {
    const ts = Date.now();
    await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `AUDIT-COMP-${ts}`,
      title: "Completeness Product",
      brand: "Audit Co",
      primaryCategoryId: shirtsCategoryId,
    });

    const period = resolveReportPeriod();
    const report = await computeCompletenessReport(organizationId, period);

    expect(report.totalProducts).toBeGreaterThan(0);
    expect(report.globalScore).toBeGreaterThanOrEqual(0);
    expect(report.globalScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(report.byCategory)).toBe(true);
  });
});
