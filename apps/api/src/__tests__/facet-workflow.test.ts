import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@productinfoman/db";
import {
  createFacetDefinition,
  getCategoryFacets,
} from "../modules/taxonomy/facet.service.js";
import {
  approveFacetRule,
  createFacetRule,
  deprecateFacetRule,
  rejectFacetRule,
  submitFacetRule,
} from "../modules/taxonomy/facet-workflow.service.js";
import {
  createAttribute,
  createAttributeGroup,
  createCategory,
} from "../modules/taxonomy/taxonomy.service.js";
import { PRICE_FACET_BUCKETS } from "@productinfoman/config/facets.config";

const ORG_SLUG = "demo-facet-workflow";
let organizationId: string;
const editorActor = { userId: "editor-user" };
const approverActor = { userId: "approver-user" };

beforeAll(async () => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Facet Workflow Test", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedPriceFacet(ts: number) {
  const category = await createCategory(organizationId, {
    name: `WF Cat ${ts}`,
    code: `wf-cat-${ts}`,
    slug: `wf-cat-${ts}`,
  });

  const group = await createAttributeGroup(organizationId, {
    name: `WF Group ${ts}`,
    code: `wf-group-${ts}`,
  });

  const priceAttr = await createAttribute(organizationId, {
    attributeGroupId: group.id,
    key: `wf_price_${ts}`,
    label: "Price",
    dataType: "NUMBER",
    isFilterable: true,
  });

  const priceFacet = await createFacetDefinition(organizationId, {
    key: `wf_price_facet_${ts}`,
    label: "Price",
    sourceAttributeId: priceAttr.id,
    categoryId: category.id,
    sortOrder: 1,
  });

  return { category, priceAttr, priceFacet };
}

describe("Facet rule workflow", () => {
  it("transitions draft → in_review → approved → deprecated", async () => {
    const ts = Date.now();
    const { priceFacet } = await seedPriceFacet(ts);

    const draft = await createFacetRule(
      organizationId,
      {
        facetDefinitionId: priceFacet.id,
        ruleType: "RANGE_BUCKET",
        ruleConfig: { buckets: PRICE_FACET_BUCKETS },
      },
      editorActor,
    );
    expect(draft.workflowStateCode).toBe("draft");

    const submitted = await submitFacetRule(draft.id, organizationId, editorActor);
    expect(submitted.workflowStateCode).toBe("in_review");

    const approved = await approveFacetRule(submitted.id, organizationId, approverActor, "LGTM");
    expect(approved.workflowStateCode).toBe("approved");
    expect(approved.reviewedBy).toBe(approverActor.userId);

    const deprecated = await deprecateFacetRule(approved.id, organizationId, approverActor);
    expect(deprecated.workflowStateCode).toBe("deprecated");
  });

  it("rejects in_review back to draft", async () => {
    const ts = Date.now();
    const { priceFacet } = await seedPriceFacet(ts);

    const draft = await createFacetRule(
      organizationId,
      { facetDefinitionId: priceFacet.id, ruleType: "DIRECT" },
      editorActor,
    );
    await submitFacetRule(draft.id, organizationId, editorActor);
    const rejected = await rejectFacetRule(draft.id, organizationId, approverActor, "Fix buckets");
    expect(rejected.workflowStateCode).toBe("draft");
    expect(rejected.notes).toBe("Fix buckets");
  });

  it("only approved rules affect category facet resolution", async () => {
    const ts = Date.now();
    const { category, priceFacet } = await seedPriceFacet(ts);

    const draft = await createFacetRule(
      organizationId,
      {
        facetDefinitionId: priceFacet.id,
        ruleType: "RANGE_BUCKET",
        ruleConfig: { buckets: PRICE_FACET_BUCKETS },
        priority: 10,
      },
      editorActor,
    );

    let facets = await getCategoryFacets(category.id, organizationId);
    let priceFacetResult = facets.find((f) => f.key === priceFacet.key);
    expect(priceFacetResult?.options ?? []).toHaveLength(0);

    await submitFacetRule(draft.id, organizationId, editorActor);
    await approveFacetRule(draft.id, organizationId, approverActor);

    facets = await getCategoryFacets(category.id, organizationId);
    priceFacetResult = facets.find((f) => f.key === priceFacet.key);
    expect(priceFacetResult?.options.length).toBeGreaterThan(0);
  });

  it("blocks edit on approved rules", async () => {
    const ts = Date.now();
    const { priceFacet } = await seedPriceFacet(ts);

    const draft = await createFacetRule(
      organizationId,
      { facetDefinitionId: priceFacet.id, ruleType: "DIRECT" },
      editorActor,
    );
    await submitFacetRule(draft.id, organizationId, editorActor);
    await approveFacetRule(draft.id, organizationId, approverActor);

    const { updateFacetRule } = await import("../modules/taxonomy/facet-workflow.service.js");
    await expect(
      updateFacetRule(draft.id, organizationId, { priority: 5 }, editorActor),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("writes audit logs for workflow actions", async () => {
    const ts = Date.now();
    const { priceFacet } = await seedPriceFacet(ts);

    const draft = await createFacetRule(
      organizationId,
      { facetDefinitionId: priceFacet.id, ruleType: "DIRECT" },
      editorActor,
    );
    await submitFacetRule(draft.id, organizationId, editorActor);
    await approveFacetRule(draft.id, organizationId, approverActor);

    const logs = await prisma.auditLog.findMany({
      where: { organizationId, entityType: "facet_rule", entityId: draft.id },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs.some((log) => log.action === "STATE_CHANGE")).toBe(true);
  });
});
