import type {
  CreateProductInput,
  CreateVariantInput,
  ListProductsQuery,
  ProductDto,
  ResolvedAttribute,
  SetAttributesInput,
  UpdateProductInput,
} from "@productinfoman/contracts";
import { createEvent } from "@productinfoman/contracts";
import {
  resolveAttributes,
  variantAxisKey,
  type StoredAttributeValue,
} from "@productinfoman/inheritance-engine";
import type { Prisma, Product } from "../../../../generated/prisma/client.js";
import { emitEvent } from "../../lib/events.js";
import { prisma } from "../../lib/prisma.js";

type ProductWithValues = Product & {
  attributeValues: Array<{
    value: unknown;
    source: "LOCAL" | "INHERITED" | "OVERRIDDEN";
    attributeDefinition: { id: string; key: string };
  }>;
  parent?: ProductWithValues | null;
};

async function getEffectiveSchema(organizationId: string, categoryId: string | null) {
  const globalAttrs = await prisma.attributeDefinition.findMany({
    where: { organizationId, isGlobal: true },
    include: {
      categoryBindings: categoryId
        ? { where: { categoryAttributeSet: { categoryId } } }
        : false,
    },
  });

  let categoryAttrs: typeof globalAttrs = [];
  if (categoryId) {
    const set = await prisma.categoryAttributeSet.findUnique({
      where: { categoryId },
      include: {
        bindings: {
          include: { attributeDefinition: true },
        },
      },
    });
    if (set) {
      categoryAttrs = set.bindings.map((b) => ({
        ...b.attributeDefinition,
        categoryBindings: [b],
      }));
    }
  }

  const merged = new Map<string, (typeof globalAttrs)[0]>();
  for (const a of globalAttrs) merged.set(a.id, a);
  for (const a of categoryAttrs) merged.set(a.id, a);

  return [...merged.values()].map((a) => ({
    id: a.id,
    key: a.key,
    inheritFromParent:
      a.categoryBindings?.[0]?.inheritFromParent ?? a.isGlobal,
  }));
}

function toStoredValues(product: ProductWithValues): StoredAttributeValue[] {
  return product.attributeValues.map((v) => ({
    attributeDefinitionId: v.attributeDefinition.id,
    key: v.attributeDefinition.key,
    value: v.value,
    source: v.source,
  }));
}

async function toProductDto(product: ProductWithValues): Promise<ProductDto> {
  const categoryId = product.primaryCategoryId;
  const schema = await getEffectiveSchema(product.organizationId, categoryId);

  let resolved: ResolvedAttribute[] = [];

  if (product.productType === "VARIANT" && product.parent) {
    const parentWithValues = await prisma.product.findUnique({
      where: { id: product.parent.id },
      include: {
        attributeValues: { include: { attributeDefinition: true } },
      },
    });
    const parentStored = parentWithValues
      ? toStoredValues(parentWithValues as ProductWithValues)
      : [];
    const childStored = toStoredValues(product);
    resolved = resolveAttributes(schema, parentStored, childStored).map((r) => ({
      key: r.key,
      attributeDefinitionId: r.attributeDefinitionId,
      value: r.value,
      source: r.source,
    }));
  } else {
    resolved = toStoredValues(product).map((v) => ({
      key: v.key,
      attributeDefinitionId: v.attributeDefinitionId,
      value: v.value,
      source: v.source,
    }));
  }

  return {
    id: product.id,
    organizationId: product.organizationId,
    productType: product.productType,
    sku: product.sku,
    parentId: product.parentId,
    status: product.status,
    title: product.title,
    description: product.description,
    brand: product.brand,
    primaryCategoryId: product.primaryCategoryId,
    attributes: resolved,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

async function loadProduct(id: string, organizationId: string) {
  return prisma.product.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: {
      attributeValues: { include: { attributeDefinition: true } },
      parent: true,
    },
  });
}

export async function createProduct(
  organizationId: string,
  input: CreateProductInput,
): Promise<ProductDto> {
  if (input.productType === "VARIANT" && !input.parentId) {
    throw Object.assign(new Error("VARIANT requires parentId"), { statusCode: 400 });
  }
  if (input.productType !== "VARIANT" && input.parentId) {
    throw Object.assign(new Error("Only VARIANT can have parentId"), { statusCode: 400 });
  }

  if (input.parentId) {
    const parent = await prisma.product.findFirst({
      where: { id: input.parentId, organizationId, deletedAt: null },
    });
    if (!parent || parent.productType !== "PARENT") {
      throw Object.assign(new Error("parentId must reference a PARENT product"), {
        statusCode: 400,
      });
    }
  }

  try {
    const product = await prisma.product.create({
      data: {
        organizationId,
        productType: input.productType,
        sku: input.sku,
        title: input.title,
        description: input.description,
        brand: input.brand,
        primaryCategoryId: input.primaryCategoryId,
        parentId: input.parentId,
      },
      include: {
        attributeValues: { include: { attributeDefinition: true } },
        parent: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        entityType: "Product",
        entityId: product.id,
        productId: product.id,
        action: "CREATE",
        changes: { sku: product.sku, productType: product.productType },
      },
    });

    emitEvent(
      createEvent("product.created", organizationId, {
        productId: product.id,
        sku: product.sku,
        productType: product.productType,
        status: product.status,
      }),
    );

    return toProductDto(product as ProductWithValues);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      throw Object.assign(new Error(`SKU already exists: ${input.sku}`), { statusCode: 409 });
    }
    throw e;
  }
}

export async function listProducts(
  organizationId: string,
  query: ListProductsQuery,
): Promise<{ items: ProductDto[]; total: number; page: number; pageSize: number }> {
  const where: Prisma.ProductWhereInput = {
    organizationId,
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.productType && { productType: query.productType }),
    ...(query.parentId && { parentId: query.parentId }),
    ...(query.sku && { sku: { contains: query.sku, mode: "insensitive" } }),
    ...(query.title && { title: { contains: query.title, mode: "insensitive" } }),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: {
        attributeValues: { include: { attributeDefinition: true } },
        parent: true,
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const items = await Promise.all(
    products.map((p) => toProductDto(p as ProductWithValues)),
  );

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getProduct(id: string, organizationId: string): Promise<ProductDto> {
  const product = await loadProduct(id, organizationId);
  if (!product) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }
  return toProductDto(product as ProductWithValues);
}

export async function updateProduct(
  id: string,
  organizationId: string,
  input: UpdateProductInput,
): Promise<ProductDto> {
  const existing = await loadProduct(id, organizationId);
  if (!existing) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.brand !== undefined && { brand: input.brand }),
      ...(input.primaryCategoryId !== undefined && {
        primaryCategoryId: input.primaryCategoryId,
      }),
    },
    include: {
      attributeValues: { include: { attributeDefinition: true } },
      parent: true,
    },
  });

  emitEvent(
    createEvent("product.updated", organizationId, {
      productId: id,
      changedFields: Object.keys(input),
    }),
  );

  return toProductDto(product as ProductWithValues);
}

export async function deleteProduct(id: string, organizationId: string): Promise<void> {
  const existing = await loadProduct(id, organizationId);
  if (!existing) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  emitEvent(
    createEvent("product.deleted", organizationId, { productId: id }),
  );
}

export async function setProductAttributes(
  id: string,
  organizationId: string,
  input: SetAttributesInput,
): Promise<ProductDto> {
  const product = await loadProduct(id, organizationId);
  if (!product) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }

  const defs = await prisma.attributeDefinition.findMany({
    where: {
      organizationId,
      key: { in: Object.keys(input.attributes) },
    },
  });
  const defByKey = new Map(defs.map((d) => [d.key, d]));

  for (const [key, value] of Object.entries(input.attributes)) {
    const def = defByKey.get(key);
    if (!def) {
      throw Object.assign(new Error(`Unknown attribute: ${key}`), { statusCode: 400 });
    }

    let source: "LOCAL" | "OVERRIDDEN" = "LOCAL";
    if (product.productType === "VARIANT" && product.parentId) {
      const parentVal = await prisma.productAttributeValue.findUnique({
        where: {
          productId_attributeDefinitionId: {
            productId: product.parentId,
            attributeDefinitionId: def.id,
          },
        },
      });
      if (parentVal && JSON.stringify(parentVal.value) !== JSON.stringify(value)) {
        source = "OVERRIDDEN";
      }
    }

    await prisma.productAttributeValue.upsert({
      where: {
        productId_attributeDefinitionId: {
          productId: id,
          attributeDefinitionId: def.id,
        },
      },
      create: {
        productId: id,
        attributeDefinitionId: def.id,
        value: value as Prisma.InputJsonValue,
        source,
      },
      update: {
        value: value as Prisma.InputJsonValue,
        source,
      },
    });
  }

  emitEvent(
    createEvent("product.attributes_changed", organizationId, {
      productId: id,
      attributeKeys: Object.keys(input.attributes),
    }),
  );

  return getProduct(id, organizationId);
}

export async function createVariant(
  parentId: string,
  organizationId: string,
  input: CreateVariantInput,
): Promise<ProductDto> {
  const parent = await loadProduct(parentId, organizationId);
  if (!parent || parent.productType !== "PARENT") {
    throw Object.assign(new Error("Parent PARENT product not found"), { statusCode: 404 });
  }

  const axisDefs = await prisma.attributeDefinition.findMany({
    where: {
      organizationId,
      isVariantAxis: true,
    },
  });
  const axisKeys = axisDefs.map((d) => d.key);

  for (const key of axisKeys) {
    if (input.attributes[key] === undefined || input.attributes[key] === "") {
      throw Object.assign(new Error(`Variant axis required: ${key}`), { statusCode: 400 });
    }
  }

  const siblings = await prisma.product.findMany({
    where: { organizationId, parentId, deletedAt: null },
    include: { attributeValues: { include: { attributeDefinition: true } } },
  });

  const newKey = variantAxisKey(axisKeys, input.attributes);
  for (const sibling of siblings) {
    const siblingAttrs: Record<string, unknown> = {};
    for (const v of sibling.attributeValues) {
      siblingAttrs[v.attributeDefinition.key] = v.value;
    }
    if (variantAxisKey(axisKeys, siblingAttrs) === newKey) {
      throw Object.assign(new Error("Duplicate variant axis combination"), { statusCode: 409 });
    }
  }

  const variant = await createProduct(organizationId, {
    productType: "VARIANT",
    sku: input.sku,
    title: input.title ?? parent.title,
    description: parent.description ?? undefined,
    brand: parent.brand ?? undefined,
    primaryCategoryId: parent.primaryCategoryId ?? undefined,
    parentId,
  });

  if (Object.keys(input.attributes).length > 0) {
    return setProductAttributes(variant.id, organizationId, {
      attributes: input.attributes,
    });
  }

  return variant;
}

export async function listVariants(
  parentId: string,
  organizationId: string,
): Promise<ProductDto[]> {
  const parent = await loadProduct(parentId, organizationId);
  if (!parent) {
    throw Object.assign(new Error("Parent product not found"), { statusCode: 404 });
  }

  const { items } = await listProducts(organizationId, {
    parentId,
    page: 1,
    pageSize: 100,
  });
  return items;
}
