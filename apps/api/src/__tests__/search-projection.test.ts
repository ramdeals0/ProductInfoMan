import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "@productinfoman/db";
import { createProduct } from "../modules/product-core/product.service.js";
import {
  approveProduct,
  rejectProduct,
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

async function approveProductForSearch(productId: string) {
  await submitProduct(productId, organizationId, { userId: editorUserId, role: "EDITOR" });
  await approveProduct(productId, organizationId, { userId: reviewerUserId, role: "REVIEWER" });
}

describe("search projection service", () => {
  // Phase 5 spec §8: buildProjection constructs correct projection for sample product.
  it("builds a projection with facets and category paths for approved products", async () => {
    const parent = await createProduct(organizationId, {
      productType: "PARENT",
      sku: `SEARCH-PROJ-${Date.now()}`,
      title: "Projection Parent Shirt",
      brand: "Acme",
      primaryCategoryId: shirtsCategoryId,
    });

    const colorAttr = await prisma.attributeDefinition.findFirst({
      where: { organizationId, key: "color" },
    });
    if (!colorAttr) throw new Error("Seed attribute color is required");

    const variant = await createProduct(organizationId, {
      productType: "VARIANT",
      sku: `SEARCH-PROJ-V-${Date.now()}`,
      title: "Projection Variant",
      parentId: parent.id,
      primaryCategoryId: shirtsCategoryId,
    });

    await prisma.productAttributeValue.create({
      data: {
        productId: variant.id,
        attributeDefinitionId: colorAttr.id,
        value: "Blue",
        source: "LOCAL",
      },
    });

    await approveProductForSearch(variant.id);

    const debug = await getSearchDebug(variant.id, organizationId);
    expect(debug.isIndexable).toBe(true);
    expect(debug.projectedDocument).not.toBeNull();
    expect(debug.projectedDocument?.facet_fields.color).toBe("Blue");
    expect(debug.projectedDocument?.category_ids).toContain(shirtsCategoryId);
    expect(debug.projectedDocument?.parent_product_id).toBe(parent.id);
  });

  // Phase 5 spec §8: indexProduct stores doc in test index.
  it("indexes approved products into the search store", async () => {
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `SEARCH-IDX-${Date.now()}`,
      title: "Indexed Shirt",
      primaryCategoryId: shirtsCategoryId,
    });

    await approveProductForSearch(product.id);
    await indexProduct(product.id, organizationId);

    const debug = await getSearchDebug(product.id, organizationId);
    expect(debug.indexedDocument).not.toBeNull();
    expect(debug.indexedDocument?.product_id).toBe(product.id);
  });

  // Phase 5 spec §8: Products in draft/rejected state are not indexed.
  it("does not index draft or rejected products", async () => {
    const draft = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `SEARCH-DRAFT-${Date.now()}`,
      title: "Draft Search Product",
      primaryCategoryId: shirtsCategoryId,
    });

    await indexProduct(draft.id, organizationId);
    const draftDebug = await getSearchDebug(draft.id, organizationId);
    expect(draftDebug.isIndexable).toBe(false);
    expect(draftDebug.indexedDocument).toBeNull();

    const rejected = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `SEARCH-REJ-${Date.now()}`,
      title: "Rejected Search Product",
      primaryCategoryId: shirtsCategoryId,
    });
    await submitProduct(rejected.id, organizationId, { userId: editorUserId, role: "EDITOR" });
    await rejectProduct(
      rejected.id,
      organizationId,
      { userId: reviewerUserId, role: "REVIEWER" },
      { reason: "Incomplete data" },
    );

    await indexProduct(rejected.id, organizationId);
    const rejectedDebug = await getSearchDebug(rejected.id, organizationId);
    expect(rejectedDebug.isIndexable).toBe(false);
    expect(rejectedDebug.indexedDocument).toBeNull();
  });

  // Phase 5 spec §8: Facets aggregation returns facet counts matching data.
  it("returns search results with facet aggregations and parent grouping", async () => {
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

    await approveProductForSearch(parent.id);
    await approveProductForSearch(variant.id);
    await indexProduct(parent.id, organizationId);
    await indexProduct(variant.id, organizationId);

    const categoryResults = await searchProducts(organizationId, {
      q: "Search Variant Shirt",
      categoryId: shirtsCategoryId,
      page: 1,
      pageSize: 20,
    });
    expect(categoryResults.items.some((item) => item.product_id === variant.id)).toBe(true);

    const facets = await getSearchFacets(organizationId, {
      q: "Search Variant Shirt",
      categoryId: shirtsCategoryId,
      page: 1,
      pageSize: 20,
    });
    const colorFacet = facets.facets.find((facet) => facet.key === "color");
    expect(colorFacet?.buckets.some((bucket) => bucket.value === "Blue" && bucket.count >= 1)).toBe(
      true,
    );

    const grouped = await searchProducts(organizationId, {
      q: "Search Variant Shirt",
      categoryId: shirtsCategoryId,
      groupByParent: true,
      page: 1,
      pageSize: 20,
    });
    expect(grouped.groups?.some((group) => group.group_key === parent.id)).toBe(true);
  });

  it("filters search results by facet values", async () => {
    const blueProduct = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `SEARCH-FILTER-BLUE-${Date.now()}`,
      title: "Facet Filter Blue Shirt",
      brand: "Acme",
      primaryCategoryId: shirtsCategoryId,
    });
    const whiteProduct = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: `SEARCH-FILTER-WHITE-${Date.now()}`,
      title: "Facet Filter White Shirt",
      brand: "Acme",
      primaryCategoryId: shirtsCategoryId,
    });

    const colorAttr = await prisma.attributeDefinition.findFirst({
      where: { organizationId, key: "color" },
    });
    if (!colorAttr) throw new Error("Seed attribute color is required");

    await prisma.productAttributeValue.createMany({
      data: [
        {
          productId: blueProduct.id,
          attributeDefinitionId: colorAttr.id,
          value: "Blue",
          source: "LOCAL",
        },
        {
          productId: whiteProduct.id,
          attributeDefinitionId: colorAttr.id,
          value: "White",
          source: "LOCAL",
        },
      ],
      skipDuplicates: true,
    });

    await approveProductForSearch(blueProduct.id);
    await approveProductForSearch(whiteProduct.id);
    await indexProduct(blueProduct.id, organizationId);
    await indexProduct(whiteProduct.id, organizationId);

    const filtered = await searchProducts(organizationId, {
      q: "Facet Filter",
      categoryId: shirtsCategoryId,
      filters: { color: "Blue" },
      page: 1,
      pageSize: 20,
    });

    expect(filtered.items.some((item) => item.product_id === blueProduct.id)).toBe(true);
    expect(filtered.items.some((item) => item.product_id === whiteProduct.id)).toBe(false);
  });

  // Phase 5 spec §8: ReindexAll indexes only approved/published products.
  it("runs full reindex for indexable products only", async () => {
    const run = await startReindex(organizationId);
    expect(run.status).toBe("QUEUED");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const updated = await prisma.searchReindexRun.findUnique({ where: { id: run.id } });
    expect(updated?.status).toBe("COMPLETED");
    expect(updated!.indexedCount).toBeGreaterThan(0);
  });
});
