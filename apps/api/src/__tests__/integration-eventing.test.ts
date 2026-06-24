import { describe, expect, it, vi, beforeAll, afterEach } from "vitest";
import { prisma } from "@productinfoman/db";
import { createEvent } from "@productinfoman/contracts";
import { createProduct } from "../modules/product-core/product.service.js";
import {
  approveProduct,
  submitProduct,
} from "../modules/workflow/workflow.service.js";
import {
  getOutboxEvent,
  listOutboxEvents,
  replayEvents,
  retryEventById,
} from "../modules/integration/integration.service.js";
import { dispatchOutboxEvent } from "../modules/integration/integration.dispatcher.js";
import { publishDomainEvent } from "../modules/integration/integration.publisher.js";
import * as consumers from "../modules/integration/integration.consumers.js";
import { InMemorySearchStore, resetSearchStore } from "../modules/search/search.store.js";

const ORG_SLUG = "demo";
let organizationId: string;
let editorUserId: string;
let reviewerUserId: string;
let shirtsCategoryId: string;

beforeAll(async () => {
  resetSearchStore(new InMemorySearchStore());

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;

  const editor = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "evt-editor@demo.local" } },
    create: {
      organizationId,
      email: "evt-editor@demo.local",
      name: "Event Editor",
      role: "EDITOR",
    },
    update: { role: "EDITOR" },
  });
  editorUserId = editor.id;

  const reviewer = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "evt-reviewer@demo.local" } },
    create: {
      organizationId,
      email: "evt-reviewer@demo.local",
      name: "Event Reviewer",
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
    where: { organizationId_code: { organizationId, code: "event-test-lifecycle" } },
    create: {
      organizationId,
      code: "event-test-lifecycle",
      name: "Event Test Lifecycle",
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("integration and eventing layer", () => {
  // Phase 8 spec §8: Writing to outbox via EventPublisher.
  it("writes validated domain events to the outbox via EventPublisher", async () => {
    const event = createEvent("import.job.failed", organizationId, {
      importJobId: crypto.randomUUID(),
      status: "FAILED",
      errorMessage: "Test failure",
    });

    const outboxId = await publishDomainEvent(event);
    const stored = await getOutboxEvent(outboxId, organizationId);

    expect(stored.eventType).toBe("import.job.failed");
    expect(stored.status).toBe("PENDING");
    expect(stored.aggregateType).toBe("ImportJob");
  });

  // Phase 8 spec §8: Dispatcher moves events to queue and updates status.
  it("stores emitted domain events in the outbox and dispatches consumers", async () => {
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `EVT-${Date.now()}`,
      title: "Event Test Product",
      primaryCategoryId: shirtsCategoryId,
    });

    const outbox = await listOutboxEvents(organizationId, {
      eventType: "product.created",
      page: 1,
      pageSize: 20,
    });

    const createdEvent = outbox.items.find(
      (item) => item.payloadJson.productId === product.id,
    );
    expect(createdEvent).toBeDefined();
    expect(createdEvent?.status).toBe("PUBLISHED");
    expect(createdEvent?.aggregateType).toBe("Product");

    const consumption = await prisma.eventConsumptionLog.findMany({
      where: { eventId: createdEvent!.id, status: "COMPLETED" },
    });
    expect(consumption.some((log) => log.consumerName === "search-sync")).toBe(true);
    expect(consumption.some((log) => log.consumerName === "audit-sync")).toBe(true);
  });

  // Phase 8 spec §8: Consumer processing + consumption log idempotency.
  it("processes consumers idempotently on replay", async () => {
    const event = createEvent("audit.record.created", organizationId, {
      auditLogId: crypto.randomUUID(),
      entityType: "Product",
      entityId: "prod-replay",
      action: "CREATE",
      productId: "prod-replay",
    });

    const outboxId = await publishDomainEvent(event);
    await dispatchOutboxEvent(outboxId, organizationId);
    await dispatchOutboxEvent(outboxId, organizationId);

    const logs = await prisma.eventConsumptionLog.findMany({
      where: { eventId: outboxId, consumerName: "reporting-sync" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.status).toBe("COMPLETED");
  });

  // Phase 8 spec §8: workflow.state.changed → search index + audit via consumers.
  it("routes workflow.state.changed to search and audit consumers", async () => {
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `EVT-WF-${Date.now()}`,
      title: "Workflow Event Product",
      primaryCategoryId: shirtsCategoryId,
    });

    await submitProduct(product.id, organizationId, { userId: editorUserId, role: "EDITOR" });
    await approveProduct(product.id, organizationId, { userId: reviewerUserId, role: "REVIEWER" });

    const outbox = await listOutboxEvents(organizationId, {
      eventType: "workflow.state.changed",
      page: 1,
      pageSize: 50,
    });

    const workflowEvents = outbox.items.filter(
      (item) => item.payloadJson.productId === product.id,
    );
    expect(workflowEvents.length).toBeGreaterThanOrEqual(2);

    const latest = workflowEvents[0]!;
    const consumption = await prisma.eventConsumptionLog.findMany({
      where: { eventId: latest.id, status: "COMPLETED" },
    });
    expect(consumption.some((log) => log.consumerName === "search-sync")).toBe(true);
    expect(consumption.some((log) => log.consumerName === "audit-sync")).toBe(true);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        entityId: product.id,
        action: "STATE_CHANGE",
      },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
  });

  // Phase 8 spec §8: Dead-letter on repeated consumer failure.
  it("inserts dead-letter events after repeated consumer failures", async () => {
    vi.spyOn(consumers, "runConsumer").mockImplementation(async (consumerName) => {
      if (consumerName === "notification-sync") {
        throw new Error("Simulated consumer failure");
      }
    });

    const event = createEvent("import.job.completed", organizationId, {
      importJobId: crypto.randomUUID(),
      committedRows: 10,
      skippedRows: 0,
      status: "COMPLETED",
    });
    const outboxId = await publishDomainEvent(event);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await prisma.outboxEvent.update({
        where: { id: outboxId },
        data: { status: "PENDING", publishedAt: null },
      });
      await dispatchOutboxEvent(outboxId, organizationId);
    }

    const deadLetter = await prisma.deadLetterEvent.findFirst({
      where: { eventId: outboxId, consumerName: "notification-sync" },
    });
    expect(deadLetter).toBeDefined();
    expect(deadLetter?.lastError).toContain("Simulated consumer failure");
  });

  // Phase 8 spec §8: Replay and retry APIs.
  it("supports replay and retry APIs", async () => {
    const fromDate = new Date().toISOString();
    const event = createEvent("audit.record.created", organizationId, {
      auditLogId: crypto.randomUUID(),
      entityType: "Product",
      entityId: "prod-1",
      action: "CREATE",
      productId: "prod-1",
    });

    const outboxId = await publishDomainEvent(event);

    const replay = await replayEvents(organizationId, {
      eventType: "audit.record.created",
      fromDate,
      limit: 10,
    });
    expect(replay.replayed).toBeGreaterThan(0);
    expect(replay.eventIds).toContain(outboxId);

    await retryEventById(outboxId, organizationId);
    const refreshed = await prisma.outboxEvent.findUnique({ where: { id: outboxId } });
    expect(refreshed?.status).toBe("PUBLISHED");
  });
});
