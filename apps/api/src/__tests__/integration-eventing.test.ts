import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@productinfoman/db";
import { createEvent } from "@productinfoman/contracts";
import { createProduct } from "../modules/product-core/product.service.js";
import {
  listOutboxEvents,
  replayEvents,
  retryEventById,
} from "../modules/integration/integration.service.js";
import { dispatchOutboxEvent } from "../modules/integration/integration.dispatcher.js";
import { publishDomainEvent } from "../modules/integration/integration.publisher.js";
import { InMemorySearchStore, resetSearchStore } from "../modules/search/search.store.js";

const ORG_SLUG = "demo";
let organizationId: string;
let shirtsCategoryId: string;

beforeAll(async () => {
  resetSearchStore(new InMemorySearchStore());

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;

  const shirts = await prisma.category.findFirst({
    where: { organizationId, code: "shirts" },
  });
  if (!shirts) throw new Error("Seed category shirts is required");
  shirtsCategoryId = shirts.id;
});

describe("integration and eventing layer", () => {
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
    expect(consumption.some((log) => log.consumerName === "reporting-sync")).toBe(true);
  });

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
