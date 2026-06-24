import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@productinfoman/db";
import {
  createSurvivorshipRule,
  listSurvivorshipRules,
  processInboundProduct,
  upsertProductSystemId,
} from "../modules/mdm/mdm.service.js";
import { createProduct } from "../modules/product-core/product.service.js";

const ORG_SLUG = "demo";
let organizationId: string;

beforeAll(async () => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Product MDM layer", () => {
  it("matches inbound ERP record by existing system id", async () => {
    const ts = Date.now();
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `MDM-MATCH-${ts}`,
      title: "ERP Matched Product",
      brand: "Acme",
    });

    await upsertProductSystemId(product.id, organizationId, {
      systemCode: "ERP",
      externalKey: `ERP-${ts}`,
      isPrimary: true,
    });

    const result = await processInboundProduct(organizationId, {
      sourceSystem: "ERP",
      sourceRecordId: `inbound-${ts}`,
      payload: {
        external_id: `ERP-${ts}`,
        sku: `MDM-INBOUND-${ts}`,
        title: "Inbound ERP Title",
        brand: "Acme",
      },
    });

    expect(result.productId).toBe(product.id);
    expect(result.sourceRecord.status).toBe("MATCHED");
  });

  it("leaves unmatched records in steward queue", async () => {
    const ts = Date.now();
    const result = await processInboundProduct(organizationId, {
      sourceSystem: "ERP",
      sourceRecordId: `unmatched-${ts}`,
      payload: {
        external_id: `ERP-UNKNOWN-${ts}`,
        sku: `MDM-UNKNOWN-${ts}`,
        title: "Unknown Product",
      },
      createIfUnmatched: false,
    });

    expect(result.productId).toBeNull();
    expect(result.sourceRecord.status).toBe("UNMATCHED");
  });

  it("applies survivorship rules with PLM priority over ERP", async () => {
    const ts = Date.now();
    await createSurvivorshipRule(organizationId, {
      code: `title-test-${ts}`,
      name: "Title test",
      entityType: "product",
      attributeCode: "title",
      ruleType: "SOURCE_PRIORITY",
      ruleConfigJson: { source_priority: ["PLM", "ERP", "SUPPLIER_FEED"] },
      isActive: true,
    });

    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `MDM-SURV-${ts}`,
      title: "Master Title",
      brand: "Acme",
    });

    await processInboundProduct(organizationId, {
      sourceSystem: "ERP",
      sourceRecordId: `erp-surv-${ts}`,
      payload: {
        sku: product.sku,
        title: "ERP Title Should Lose",
      },
      createIfUnmatched: false,
    });

    const plmResult = await processInboundProduct(organizationId, {
      sourceSystem: "PLM",
      sourceRecordId: `plm-surv-${ts}`,
      payload: {
        sku: product.sku,
        title: "PLM Title Should Win",
      },
      createIfUnmatched: false,
    });

    expect(plmResult.productId).toBe(product.id);

    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updated?.title).toBe("PLM Title Should Win");
  });

  it("lists survivorship rules", async () => {
    const rules = await listSurvivorshipRules(organizationId);
    expect(rules.length).toBeGreaterThan(0);
  });
});
