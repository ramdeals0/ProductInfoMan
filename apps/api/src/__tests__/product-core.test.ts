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
    where: { organizationId_name: { organizationId, name: "Specifications" } },
    create: { organizationId, name: "Specifications", sortOrder: 1 },
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
  it("supports CRUD, duplicate rejection, inheritance, and product tree", async () => {
    const ts = Date.now();

    // Duplicate SKU rejection
    const dupSku = `TEST-DUP-${ts}`;
    await createProduct(organizationId, {
      productType: "SIMPLE",
      sku: dupSku,
      title: "Dup Test",
    });
    await expect(
      createProduct(organizationId, {
        productType: "SIMPLE",
        sku: dupSku,
        title: "Dup Test 2",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Parent + variant with inheritance
    const parent = await createProduct(organizationId, {
      productType: "PARENT",
      sku: `TEST-P-${ts}`,
      title: "Test Parent",
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
      sku: `TEST-V-${ts}`,
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

    // Product tree
    await createVariant(parent.id, organizationId, {
      sku: `TEST-V2-${ts}`,
      attributes: { color: "White", size: "L" },
    });

    const tree = await getProductTree(parent.id, organizationId);
    expect(tree.productType).toBe("PARENT");
    expect(tree.children).toHaveLength(2);
    expect(tree.children.every((c) => c.productType === "VARIANT")).toBe(true);
  });
});
