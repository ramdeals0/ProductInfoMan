import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@productinfoman/db";
import { createProduct } from "../modules/product-core/product.service.js";
import {
  approveProduct,
  submitProduct,
} from "../modules/workflow/workflow.service.js";
import {
  getSearchDebug,
  getSearchFacets,
  indexProduct,
  searchProducts,
  startReindex,
} from "../modules/search/search.service.js";
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
    where: { organizationId_email: { organizationId, email: "search-editor@demo.local" } },
    create: {
      organizationId,
      email: "search-editor@demo.local",
      name: "Search Editor",
      role: "EDITOR",
    },
    update: { role: "EDITOR" },
  });
  editorUserId = editor.id;

  const reviewer = await prisma.user.upsert({
    where: { organizationId_email: { organizationId, email: "search-reviewer@demo.local" } },
    create: {
      organizationId,
      email: "search-reviewer@demo.local",
      name: "Search Reviewer",
      role: "REVIEWER",
    },
    update: { role: "REVIEWER" },
  });
  reviewerUserId = reviewer.id;

  const shirts = await prisma.category.findFirst({
    where: { organizationId, code: "shirts" },
  });
  if (!shirts) {
    throw new Error("Seed category shirts is required for search tests");
  }
  shirtsCategoryId = shirts.id;

  const workflow = await prisma.workflowDefinition.upsert({
    where: { organizationId_code: { organizationId, code: "search-test-lifecycle" } },
    create: {
      organizationId,
      code: "search-test-lifecycle",
      name: "Search Test Lifecycle",
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
    { from: "DRAFT", to: "IN_REVIEW", actionType: "SUBMIT", allowedRoles: ["EDITOR"], requiresApproval: false, requiresJustification: false },
    { from: "IN_REVIEW", to: "APPROVED", actionType: "APPROVE", allowedRoles: ["REVIEWER"], requiresApproval: true, requiresJustification: false },
    { from: "IN_REVIEW", to: "REJECTED", actionType: "REJECT", allowedRoles: ["REVIEWER"], requiresApproval: true, requiresJustification: true },
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
          requiresApproval: transition.requiresApproval,
          requiresJustification: transition.requiresJustification,
        },
      });
    }
  }
});

describe("search projection service", () => {
  it("does not index draft products", async () => {
    const draft = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `SEARCH-DRAFT-${Date.now()}`,
      title: "Draft Search Product",
      primaryCategoryId: shirtsCategoryId,
    });

    await indexProduct(draft.id, organizationId);
    const debug = await getSearchDebug(draft.id, organizationId);

    expect(debug.isIndexable).toBe(false);
    expect(debug.indexedDocument).toBeNull();
    expect(debug.projectedDocument).toBeNull();
  });

  it("indexes approved products with facets, category filter, and parent-child grouping", async () => {
    const parent = await createProduct(organizationId, {
      productType: "PARENT",
      sku: `SEARCH-PARENT-${Date.now()}`,
      title: "Search Parent Shirt",
      brand: "Acme",
      primaryCategoryId: shirtsCategoryId,
    });

    const colorAttr = await prisma.attributeDefinition.findFirst({
      where: { organizationId, key: "color" },
    });
    const sizeAttr = await prisma.attributeDefinition.findFirst({
      where: { organizationId, key: "size" },
    });
    if (!colorAttr || !sizeAttr) {
      throw new Error("Seed attributes color/size are required");
    }

    const variant = await createProduct(organizationId, {
      productType: "VARIANT",
      sku: `SEARCH-VAR-${Date.now()}`,
      title: "Search Variant Shirt",
      parentId: parent.id,
      primaryCategoryId: shirtsCategoryId,
    });

    await prisma.productAttributeValue.createMany({
      data: [
        {
          productId: variant.id,
          attributeDefinitionId: colorAttr.id,
          value: "Blue",
          source: "LOCAL",
        },
        {
          productId: variant.id,
          attributeDefinitionId: sizeAttr.id,
          value: "M",
          source: "LOCAL",
        },
      ],
      skipDuplicates: true,
    });

    await submitProduct(parent.id, organizationId, { userId: editorUserId, role: "EDITOR" });
    await approveProduct(parent.id, organizationId, { userId: reviewerUserId, role: "REVIEWER" });
    await submitProduct(variant.id, organizationId, { userId: editorUserId, role: "EDITOR" });
    await approveProduct(variant.id, organizationId, { userId: reviewerUserId, role: "REVIEWER" });

    await indexProduct(parent.id, organizationId);
    await indexProduct(variant.id, organizationId);

    const parentDebug = await getSearchDebug(parent.id, organizationId);
    const variantDebug = await getSearchDebug(variant.id, organizationId);

    expect(parentDebug.isIndexable).toBe(true);
    expect(parentDebug.indexedDocument).not.toBeNull();
    expect(variantDebug.indexedDocument?.group_key).toBe(parent.id);
    expect(variantDebug.indexedDocument?.parent_product_id).toBe(parent.id);

    const categoryResults = await searchProducts(organizationId, {
      categoryId: shirtsCategoryId,
      page: 1,
      pageSize: 20,
    });
    expect(categoryResults.items.some((item) => item.product_id === variant.id)).toBe(true);

    const facets = await getSearchFacets(organizationId, {
      categoryId: shirtsCategoryId,
      page: 1,
      pageSize: 20,
    });
    const colorFacet = facets.facets.find((facet) => facet.key === "color");
    expect(colorFacet?.buckets.some((bucket) => bucket.value === "Blue" && bucket.count >= 1)).toBe(
      true,
    );

    const grouped = await searchProducts(organizationId, {
      categoryId: shirtsCategoryId,
      groupByParent: true,
      page: 1,
      pageSize: 20,
    });
    expect(grouped.groups?.some((group) => group.group_key === parent.id)).toBe(true);
  });

  it("runs reindex asynchronously via sync queue fallback", async () => {
    const run = await startReindex(organizationId);
    expect(run.status).toBe("QUEUED");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const updated = await prisma.searchReindexRun.findUnique({ where: { id: run.id } });
    expect(updated?.status).toBe("COMPLETED");
    expect(updated!.indexedCount).toBeGreaterThan(0);
  });
});
