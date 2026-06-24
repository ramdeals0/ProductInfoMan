import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@productinfoman/db";
import { createProduct } from "../modules/product-core/product.service.js";
import {
  approveProduct,
  submitProduct,
} from "../modules/workflow/workflow.service.js";
import {
  createChannel,
  createChannelMappings,
  getPublishArtifact,
  getPublishJob,
  previewChannel,
  retryPublishJob,
  startDryRun,
  startPublishRun,
} from "../modules/publish/publish.service.js";

const ORG_SLUG = "demo";
let organizationId: string;
let editorUserId: string;
let reviewerUserId: string;
let shirtsCategoryId: string;
let channelId: string;

beforeAll(async () => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;

  const editor = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "publish-editor@demo.local" } },
    create: {
      organizationId,
      email: "publish-editor@demo.local",
      name: "Publish Editor",
      role: "EDITOR",
    },
    update: { role: "EDITOR" },
  });
  editorUserId = editor.id;

  const reviewer = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "publish-reviewer@demo.local" } },
    create: {
      organizationId,
      email: "publish-reviewer@demo.local",
      name: "Publish Reviewer",
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
    where: { organizationId_code: { organizationId, code: "publish-test-lifecycle" } },
    create: {
      organizationId,
      code: "publish-test-lifecycle",
      name: "Publish Test Lifecycle",
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

  const existingChannel = await prisma.channel.findFirst({
    where: { organizationId, code: "publish-test-store" },
  });

  if (existingChannel) {
    channelId = existingChannel.id;
  } else {
    const channel = await createChannel(organizationId, {
      code: "publish-test-store",
      name: "Publish Test Store",
      type: "ECOMMERCE",
      destinationType: "CSV",
    });
    channelId = channel.id;

    await createChannelMappings(channelId, organizationId, [
      { sourceField: "sku", targetField: "Variant SKU", isRequired: true, sortOrder: 0 },
      { sourceField: "title", targetField: "Title", isRequired: true, sortOrder: 1 },
      { sourceField: "brand", targetField: "Vendor", isRequired: false, sortOrder: 2 },
      { sourceField: "attributes.color", targetField: "Color", isRequired: false, sortOrder: 3 },
      { sourceField: "attributes.size", targetField: "Size", isRequired: false, sortOrder: 4 },
      { sourceField: "category_code", targetField: "Product Type", isRequired: false, sortOrder: 5 },
    ]);

    await prisma.channelValidationRule.create({
      data: {
        organizationId,
        channelId,
        code: "allowed-status",
        name: "Allowed publish statuses",
        ruleType: "ALLOWED_STATUS",
        ruleConfig: { statuses: ["APPROVED", "PUBLISH_READY", "PUBLISHED"] },
      },
    });
  }
});

describe("publishing and syndication service", () => {
  it("excludes draft products from publish jobs", async () => {
    const draft = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `PUB-DRAFT-${Date.now()}`,
      title: "Draft Publish Product",
      primaryCategoryId: shirtsCategoryId,
    });

    const job = await startDryRun(organizationId, {
      channelId,
      productIds: [draft.id],
    });

    const detail = await getPublishJob(job.id, organizationId);
    expect(detail.items[0]?.status).toBe("SKIPPED");
    expect(detail.successfulItems).toBe(0);
  });

  it("generates dry-run export with channel mappings for approved products", async () => {
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `PUB-APPROVED-${Date.now()}`,
      title: "Approved Publish Product",
      brand: "Acme",
      primaryCategoryId: shirtsCategoryId,
    });

    await submitProduct(product.id, organizationId, { userId: editorUserId, role: "EDITOR" });
    await approveProduct(product.id, organizationId, { userId: reviewerUserId, role: "REVIEWER" });

    const preview = await previewChannel(channelId, organizationId, product.id);
    expect(preview.previews[0]?.isPublishable).toBe(true);
    expect(preview.previews[0]?.fields.Title).toBe("Approved Publish Product");
    expect(preview.previews[0]?.fields.Vendor).toBe("Acme");

    const job = await startDryRun(organizationId, {
      channelId,
      productIds: [product.id],
    });

    const detail = await getPublishJob(job.id, organizationId);
    expect(detail.status).toBe("COMPLETED");
    expect(detail.successfulItems).toBe(1);
    expect(detail.artifacts.length).toBe(1);

    const { content } = await getPublishArtifact(job.id, organizationId);
    expect(content).toContain("Variant SKU,Title,Vendor,Color,Size,Product Type");
    expect(content).toContain(product.sku);
    expect(content).toContain("Approved Publish Product");
  });

  it("supports live export and retrying failed jobs", async () => {
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `PUB-LIVE-${Date.now()}`,
      title: "Live Export Product",
      brand: "Acme",
      primaryCategoryId: shirtsCategoryId,
    });

    await submitProduct(product.id, organizationId, { userId: editorUserId, role: "EDITOR" });
    await approveProduct(product.id, organizationId, { userId: reviewerUserId, role: "REVIEWER" });

    const job = await startPublishRun(organizationId, {
      channelId,
      productIds: [product.id],
    });

    const detail = await getPublishJob(job.id, organizationId);
    expect(detail.mode).toBe("LIVE");
    expect(detail.status).toBe("COMPLETED");
    expect(detail.successfulItems).toBe(1);

    await prisma.publishJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: "Simulated failure" },
    });

    const retried = await retryPublishJob(job.id, organizationId);
    expect(retried.status).toBe("COMPLETED");

    const history = await prisma.publishHistory.findMany({
      where: { publishJobId: job.id, action: "RETRY" },
    });
    expect(history.length).toBeGreaterThan(0);
  });
});
