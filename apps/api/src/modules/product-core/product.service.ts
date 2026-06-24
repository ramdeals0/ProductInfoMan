import type { ProductEntity, ProductTreeNode } from "@productinfoman/domain";
import { isStorefrontVisible } from "@productinfoman/domain";
import type {
  CreateProductInput,
  CreateVariantInput,
  ListProductsQuery,
  SetAttributesInput,
  UpdateProductInput,
} from "@productinfoman/validation";
import { createEvent } from "@productinfoman/contracts";
import {
  resolveAttributes,
  variantAxisKey,
  type StoredAttributeValue,
} from "@productinfoman/inheritance-engine";
import { prisma } from "@productinfoman/db";
import { sanitizeDisplayText } from "@productinfoman/config";
import { appError, recordChange, recordSnapshot } from "@productinfoman/shared";
import type { Prisma, Product } from "../../../../generated/prisma/client.js";
import { emitEvent } from "../../lib/events.js";
import { emitAuditRecordEvent } from "../../lib/audit-events.js";

import type { ResolvedAttribute } from "@productinfoman/domain";

type ProductDto = ProductEntity;

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

type EffectiveSchema = Awaited<ReturnType<typeof getEffectiveSchema>>;
type SchemaCache = Map<string, Promise<EffectiveSchema>>;

function schemaCacheKey(organizationId: string, categoryId: string | null): string {
  return `${organizationId}:${categoryId ?? "none"}`;
}

async function getEffectiveSchemaCached(
  organizationId: string,
  categoryId: string | null,
  cache?: SchemaCache,
): Promise<EffectiveSchema> {
  if (!cache) {
    return getEffectiveSchema(organizationId, categoryId);
  }

  const key = schemaCacheKey(organizationId, categoryId);
  let pending = cache.get(key);
  if (!pending) {
    pending = getEffectiveSchema(organizationId, categoryId);
    cache.set(key, pending);
  }
  return pending;
}

function toStoredValues(product: ProductWithValues): StoredAttributeValue[] {
  return product.attributeValues.map((v) => ({
    attributeDefinitionId: v.attributeDefinition.id,
    key: v.attributeDefinition.key,
    value: v.value,
    source: v.source,
  }));
}

function enrichStoredFromCoreFields(
  product: ProductWithValues,
  schema: Array<{ id: string; key: string }>,
  stored: StoredAttributeValue[],
): StoredAttributeValue[] {
  const byKey = new Map(stored.map((v) => [v.key, v]));
  const coreMap: Record<string, unknown> = {
    brand: product.brand,
    title: product.title,
    description: product.description,
  };

  for (const def of schema) {
    if (def.key in coreMap && coreMap[def.key] != null && !byKey.has(def.key)) {
      stored.push({
        attributeDefinitionId: def.id,
        key: def.key,
        value: coreMap[def.key],
        source: "LOCAL",
      });
    }
  }

  return stored;
}

function parseSellingPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

async function toProductDto(
  product: ProductWithValues,
  options?: { schemaCache?: SchemaCache },
): Promise<ProductDto> {
  const categoryId = product.primaryCategoryId;
  const schema = await getEffectiveSchemaCached(
    product.organizationId,
    categoryId,
    options?.schemaCache,
  );

  let resolved: ResolvedAttribute[] = [];

  if (product.productType === "VARIANT" && product.parent) {
    const parentWithValues = await prisma.product.findUnique({
      where: { id: product.parent.id },
      include: {
        attributeValues: { include: { attributeDefinition: true } },
      },
    });
    let parentStored = parentWithValues
      ? toStoredValues(parentWithValues as ProductWithValues)
      : [];
    parentStored = enrichStoredFromCoreFields(
      parentWithValues as ProductWithValues,
      schema,
      parentStored,
    );
    let childStored = toStoredValues(product);
    childStored = enrichStoredFromCoreFields(product, schema, childStored);
    resolved = resolveAttributes(schema, parentStored, childStored).map((r) => ({
      key: r.key,
      attributeDefinitionId: r.attributeDefinitionId,
      value: r.value,
      source: r.source,
    }));
  } else {
    let stored = toStoredValues(product);
    stored = enrichStoredFromCoreFields(product, schema, stored);
    resolved = stored.map((v) => ({
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
    summary: product.summary,
    sellingPoints: parseSellingPoints(product.sellingPoints),
    brand: product.brand,
    primaryCategoryId: product.primaryCategoryId,
    startDate: product.startDate?.toISOString() ?? null,
    discontinueDate: product.discontinueDate?.toISOString() ?? null,
    attributes: resolved,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function buildProductSnapshot(product: ProductDto): Record<string, unknown> {
  return {
    id: product.id,
    sku: product.sku,
    title: product.title,
    description: product.description,
    summary: product.summary,
    sellingPoints: product.sellingPoints,
    brand: product.brand,
    status: product.status,
    productType: product.productType,
    primaryCategoryId: product.primaryCategoryId,
    parentId: product.parentId,
    startDate: product.startDate,
    discontinueDate: product.discontinueDate,
    attributes: Object.fromEntries(
      product.attributes.map((attr) => [attr.key, attr.value]),
    ),
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

async function assertUniqueSku(organizationId: string, sku: string): Promise<void> {
  const existing = await prisma.product.findFirst({
    where: { organizationId, sku, deletedAt: null },
    select: { id: true },
  });
  if (existing) {
    throw appError(`SKU already exists: ${sku}`, 409);
  }
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

  await assertUniqueSku(organizationId, input.sku);

  const created = await prisma.product.create({
    data: {
      organizationId,
      productType: input.productType,
      sku: input.sku,
      title: sanitizeDisplayText(input.title),
      description: input.description ? sanitizeDisplayText(input.description) : input.description,
      summary: input.summary ? sanitizeDisplayText(input.summary) : input.summary,
      sellingPoints: input.sellingPoints ?? [],
      brand: input.brand ? sanitizeDisplayText(input.brand) : input.brand,
      primaryCategoryId: input.primaryCategoryId,
      parentId: input.parentId,
      startDate: input.startDate,
      discontinueDate: input.discontinueDate,
    },
    include: {
      attributeValues: { include: { attributeDefinition: true } },
      parent: true,
    },
  });

  const productDto = await toProductDto(created as ProductWithValues);
  const snapshot = buildProductSnapshot(productDto);

  const auditLogId = await recordChange({
    organizationId,
    entityType: "Product",
    entityId: created.id,
    productId: created.id,
    action: "CREATE",
    source: "api",
    after: snapshot,
  });

  await recordSnapshot({
    organizationId,
    entityType: "Product",
    entityId: created.id,
    snapshot,
    changeType: "CREATE",
  });

  await emitAuditRecordEvent({
    organizationId,
    auditLogId,
    entityType: "Product",
    entityId: created.id,
    action: "CREATE",
    productId: created.id,
  });

  await emitEvent(
    createEvent("product.created", organizationId, {
      productId: created.id,
      sku: created.sku,
      productType: created.productType,
      status: created.status,
    }),
  );

  return productDto;
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

  const schemaCache: SchemaCache = new Map();
  const items = await Promise.all(
    products.map((p) => toProductDto(p as ProductWithValues, { schemaCache })),
  );

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getProduct(
  id: string,
  organizationId: string,
  options?: { storefrontOnly?: boolean },
): Promise<ProductDto> {
  const product = await loadProduct(id, organizationId);
  if (!product) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }
  const dto = await toProductDto(product as ProductWithValues);
  if (options?.storefrontOnly && !isStorefrontVisible(dto)) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }
  return dto;
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

  const beforeDto = await toProductDto(existing as ProductWithValues);
  const beforeSnapshot = buildProductSnapshot(beforeDto);

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: sanitizeDisplayText(input.title) }),
      ...(input.description !== undefined && {
        description: sanitizeDisplayText(input.description),
      }),
      ...(input.summary !== undefined && {
        summary: input.summary ? sanitizeDisplayText(input.summary) : null,
      }),
      ...(input.sellingPoints !== undefined && { sellingPoints: input.sellingPoints }),
      ...(input.brand !== undefined && { brand: sanitizeDisplayText(input.brand) }),
      ...(input.primaryCategoryId !== undefined && {
        primaryCategoryId: input.primaryCategoryId,
      }),
      ...(input.startDate !== undefined && { startDate: input.startDate }),
      ...(input.discontinueDate !== undefined && { discontinueDate: input.discontinueDate }),
    },
    include: {
      attributeValues: { include: { attributeDefinition: true } },
      parent: true,
    },
  });

  await emitEvent(
    createEvent("product.updated", organizationId, {
      productId: id,
      changedFields: Object.keys(input),
    }),
  );

  const afterDto = await toProductDto(product as ProductWithValues);
  const afterSnapshot = buildProductSnapshot(afterDto);

  const auditLogId = await recordChange({
    organizationId,
    entityType: "Product",
    entityId: id,
    productId: id,
    action: "UPDATE",
    source: "api",
    before: beforeSnapshot,
    after: afterSnapshot,
  });

  await recordSnapshot({
    organizationId,
    entityType: "Product",
    entityId: id,
    snapshot: afterSnapshot,
    changeType: "UPDATE",
  });

  await emitAuditRecordEvent({
    organizationId,
    auditLogId,
    entityType: "Product",
    entityId: id,
    action: "UPDATE",
    productId: id,
  });

  return afterDto;
}

export async function deleteProduct(id: string, organizationId: string): Promise<void> {
  const existing = await loadProduct(id, organizationId);
  if (!existing) {
    throw Object.assign(new Error("Product not found"), { statusCode: 404 });
  }

  const beforeDto = await toProductDto(existing as ProductWithValues);
  const beforeSnapshot = buildProductSnapshot(beforeDto);

  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await recordChange({
    organizationId,
    entityType: "Product",
    entityId: id,
    productId: id,
    action: "DELETE",
    source: "api",
    before: beforeSnapshot,
  });

  await recordSnapshot({
    organizationId,
    entityType: "Product",
    entityId: id,
    snapshot: beforeSnapshot,
    changeType: "DELETE",
  });

  await emitEvent(
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

  await emitEvent(
    createEvent("product.attributes_changed", organizationId, {
      productId: id,
      attributeKeys: Object.keys(input.attributes),
    }),
  );

  const updated = await getProduct(id, organizationId);
  const afterSnapshot = buildProductSnapshot(updated);

  await recordChange({
    organizationId,
    entityType: "Product",
    entityId: id,
    productId: id,
    action: "UPDATE",
    source: "api",
    after: afterSnapshot,
    changedFields: { attributes: input.attributes },
  });

  await recordSnapshot({
    organizationId,
    entityType: "Product",
    entityId: id,
    snapshot: afterSnapshot,
    changeType: "UPDATE",
  });

  return updated;
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
    primaryCategoryId: parent.primaryCategoryId ?? undefined,
    parentId,
  });

  await prisma.productRelationship.upsert({
    where: {
      sourceProductId_targetProductId_relationshipType: {
        sourceProductId: variant.id,
        targetProductId: parentId,
        relationshipType: "VARIANT_OF",
      },
    },
    create: {
      organizationId,
      sourceProductId: variant.id,
      targetProductId: parentId,
      relationshipType: "VARIANT_OF",
    },
    update: {},
  });

  if (Object.keys(input.attributes).length > 0) {
    const withAttributes = await setProductAttributes(variant.id, organizationId, {
      attributes: input.attributes,
    });

    await emitEvent(
      createEvent("product.variant.created", organizationId, {
        productId: variant.id,
        parentId,
        sku: variant.sku,
        status: withAttributes.status,
      }),
    );

    return withAttributes;
  }

  await emitEvent(
    createEvent("product.variant.created", organizationId, {
      productId: variant.id,
      parentId,
      sku: variant.sku,
      status: variant.status,
    }),
  );

  return variant;
}

export async function listVariants(
  parentId: string,
  organizationId: string,
  options?: { storefrontOnly?: boolean },
): Promise<ProductDto[]> {
  const parent = await loadProduct(parentId, organizationId);
  if (!parent) {
    throw Object.assign(new Error("Parent product not found"), { statusCode: 404 });
  }

  if (options?.storefrontOnly) {
    const parentDto = await toProductDto(parent as ProductWithValues);
    if (!isStorefrontVisible(parentDto)) {
      throw Object.assign(new Error("Parent product not found"), { statusCode: 404 });
    }
  }

  const { items } = await listProducts(organizationId, {
    parentId,
    page: 1,
    pageSize: 100,
  });

  if (!options?.storefrontOnly) return items;
  return items.filter((item) => isStorefrontVisible(item));
}

export async function getProductTree(
  id: string,
  organizationId: string,
): Promise<ProductTreeNode> {
  const product = await loadProduct(id, organizationId);
  if (!product) {
    throw appError("Product not found", 404);
  }

  const parentDto = await toProductDto(product as ProductWithValues);

  if (product.productType !== "PARENT") {
    return { ...parentDto, children: [] };
  }

  const children = await listVariants(id, organizationId);
  return { ...parentDto, children };
}
