import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createProduct,
  createVariant,
  getProduct,
  getProductTree,
} from "../modules/product-core/product.service.js";
import { prisma } from "@productinfoman/db";

const ORG_SLUG = "demo";
let organizationId: string;

beforeAll(async () => {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: { name: "Demo Retailer", slug: ORG_SLUG },
    update: {},
  });
  organizationId = org.id;

  const specsGroup = await prisma.attributeGroup.upsert({
    where: { organizationId_code: { organizationId, code: "specifications" } },
    create: { organizationId, code: "specifications", name: "Specifications", sortOrder: 1 },
    update: {},
  });

  await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId, key: "brand" } },
    create: {
      organizationId,
      attributeGroupId: specsGroup.id,
      key: "brand",
      label: "Brand",
      dataType: "TEXT",
      isGlobal: true,
    },
    update: { isGlobal: true },
  });

  await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId, key: "color" } },
    create: {
      organizationId,
      attributeGroupId: specsGroup.id,
      key: "color",
      label: "Color",
      dataType: "ENUM",
      isGlobal: true,
      isVariantAxis: true,
    },
    update: { isGlobal: true, isVariantAxis: true },
  });

  await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId, key: "size" } },
    create: {
      organizationId,
      attributeGroupId: specsGroup.id,
      key: "size",
      label: "Size",
      dataType: "ENUM",
      isGlobal: true,
      isVariantAxis: true,
    },
    update: { isGlobal: true, isVariantAxis: true },
  });

  await prisma.attributeDefinition.upsert({
    where: { organizationId_key: { organizationId, key: "fabric" } },
    create: {
      organizationId,
      attributeGroupId: specsGroup.id,
      key: "fabric",
      label: "Fabric",
      dataType: "TEXT",
      isGlobal: true,
    },
    update: { isGlobal: true },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Product Core", () => {
  // Phase 1 spec §8: Creating a product with unique external_id.
  // ASSUMPTION CHANGE: external_id maps to sku in this codebase.
  it("creates a product with unique sku (external identifier)", async () => {
    const sku = `EXT-ID-${Date.now()}`;
    const product = await createProduct(organizationId, {
      productType: "SIMPLE",
      sku,
      title: "Unique Product",
    });
    expect(product.sku).toBe(sku);
    expect(product.id).toBeTruthy();
    expect(product.status).toBe("DRAFT");
  });

  // Phase 1 spec §8: Rejecting duplicate external_id.
  it("rejects duplicate sku", async () => {
    const sku = `DUP-SKU-${Date.now()}`;
    await createProduct(organizationId, {
      productType: "SIMPLE",
      sku,
      title: "First",
    });
    await expect(
      createProduct(organizationId, {
        productType: "SIMPLE",
        sku,
        title: "Second",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  // Phase 1 spec §8: Creating a variant with unique variant_sku.
  it("creates a variant with unique variant sku", async () => {
    const ts = Date.now();
    const parent = await createProduct(organizationId, {
      productType: "PARENT",
      sku: `PARENT-${ts}`,
      title: "Parent",
    });
    const variant = await createVariant(parent.id, organizationId, {
      sku: `VARIANT-${ts}`,
      attributes: { color: "Red", size: "S" },
    });
    expect(variant.productType).toBe("VARIANT");
    expect(variant.parentId).toBe(parent.id);
    expect(variant.sku).toBe(`VARIANT-${ts}`);
  });

  // Phase 1 spec §8: Rejecting duplicate variant_sku.
  it("rejects duplicate variant sku", async () => {
    const ts = Date.now();
    const parent = await createProduct(organizationId, {
      productType: "PARENT",
      sku: `P-DUP-${ts}`,
      title: "Parent",
    });
    const variantSku = `V-DUP-${ts}`;
    await createVariant(parent.id, organizationId, {
      sku: variantSku,
      attributes: { color: "Blue", size: "M" },
    });
    const otherParent = await createProduct(organizationId, {
      productType: "PARENT",
      sku: `P-DUP2-${ts}`,
      title: "Other Parent",
    });
    await expect(
      createVariant(otherParent.id, organizationId, {
        sku: variantSku,
        attributes: { color: "Green", size: "L" },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  // Phase 1 spec §8: Retrieving product tree with parent + variants.
  it("returns product tree with parent and variants", async () => {
    const ts = Date.now();
    const parent = await createProduct(organizationId, {
      productType: "PARENT",
      sku: `TREE-P-${ts}`,
      title: "Tree Parent",
    });
    await createVariant(parent.id, organizationId, {
      sku: `TREE-V1-${ts}`,
      attributes: { color: "Black", size: "S" },
    });
    await createVariant(parent.id, organizationId, {
      sku: `TREE-V2-${ts}`,
      attributes: { color: "White", size: "M" },
    });

    const tree = await getProductTree(parent.id, organizationId);
    expect(tree.productType).toBe("PARENT");
    expect(tree.children).toHaveLength(2);
    expect(tree.children.every((c) => c.productType === "VARIANT")).toBe(true);
  });

  // Phase 1 spec §8: Basic inheritance (parent attribute overridden by variant).
  it("resolves variant attributes with inheritance and overrides", async () => {
    const ts = Date.now();
    const parent = await createProduct(organizationId, {
      productType: "PARENT",
      sku: `INH-P-${ts}`,
      title: "Inheritance Parent",
      brand: "TestBrand",
    });

    const fabricDef = await prisma.attributeDefinition.findFirstOrThrow({
      where: { organizationId, key: "fabric" },
    });
    await prisma.productAttributeValue.create({
      data: {
        productId: parent.id,
        attributeDefinitionId: fabricDef.id,
        value: "Wool",
        source: "LOCAL",
      },
    });

    const variant = await createVariant(parent.id, organizationId, {
      sku: `INH-V-${ts}`,
      attributes: { color: "Blue", size: "M" },
    });

    const fetched = await getProduct(variant.id, organizationId);
    expect(fetched.attributes.find((a) => a.key === "brand")).toMatchObject({
      source: "INHERITED",
      value: "TestBrand",
    });
    expect(fetched.attributes.find((a) => a.key === "color")).toMatchObject({
      source: "LOCAL",
      value: "Blue",
    });
    expect(fetched.attributes.find((a) => a.key === "fabric")).toMatchObject({
      source: "INHERITED",
      value: "Wool",
    });
  });
});
