import {
  resolveAttributes,
  type StoredAttributeValue,
} from "@productinfoman/inheritance-engine";
import { isPublishableStatus } from "@productinfoman/publish-engine";
import { prisma } from "@productinfoman/db";
import type { CanonicalProductRecord } from "@productinfoman/publish-engine";

type LoadedProduct = NonNullable<Awaited<ReturnType<typeof loadProduct>>>;

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
        bindings: { include: { attributeDefinition: true } },
      },
    });
    if (set) {
      categoryAttrs = set.bindings.map((binding) => ({
        ...binding.attributeDefinition,
        categoryBindings: [binding],
      }));
    }
  }

  const merged = new Map<string, (typeof globalAttrs)[0]>();
  for (const attr of globalAttrs) merged.set(attr.id, attr);
  for (const attr of categoryAttrs) merged.set(attr.id, attr);
  return [...merged.values()];
}

function toStoredValues(product: LoadedProduct): StoredAttributeValue[] {
  return product.attributeValues.map((value) => ({
    attributeDefinitionId: value.attributeDefinition.id,
    key: value.attributeDefinition.key,
    value: value.value,
    source: value.source,
  }));
}

function enrichStoredFromCoreFields(
  product: LoadedProduct,
  schema: Array<{ id: string; key: string }>,
  stored: StoredAttributeValue[],
): StoredAttributeValue[] {
  const byKey = new Map(stored.map((value) => [value.key, value]));
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

async function resolveProductAttributes(product: LoadedProduct): Promise<Record<string, unknown>> {
  const categoryId = product.primaryCategoryId;
  const schema = await getEffectiveSchema(product.organizationId, categoryId);
  const schemaForResolve = schema.map((attr) => ({
    id: attr.id,
    key: attr.key,
    inheritFromParent: attr.categoryBindings?.[0]?.inheritFromParent ?? attr.isGlobal,
  }));

  let resolved: Array<{ key: string; value: unknown }> = [];

  if (product.productType === "VARIANT" && product.parent) {
    const parent = await prisma.product.findUnique({
      where: { id: product.parent.id },
      include: {
        attributeValues: { include: { attributeDefinition: true } },
      },
    });

    let parentStored = parent ? toStoredValues({ ...product, ...parent, parent: null } as LoadedProduct) : [];
    parentStored = enrichStoredFromCoreFields(
      { ...product, ...parent, parent: null } as LoadedProduct,
      schema,
      parentStored,
    );
    let childStored = toStoredValues(product);
    childStored = enrichStoredFromCoreFields(product, schema, childStored);
    resolved = resolveAttributes(schemaForResolve, parentStored, childStored);
  } else {
    let stored = toStoredValues(product);
    stored = enrichStoredFromCoreFields(product, schema, stored);
    resolved = stored.map((attr) => ({ key: attr.key, value: attr.value }));
  }

  return Object.fromEntries(resolved.map((attr) => [attr.key, attr.value]));
}

async function loadProduct(productId: string, organizationId: string) {
  return prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    include: {
      attributeValues: { include: { attributeDefinition: true } },
      parent: true,
      primaryCategory: true,
    },
  });
}

export async function loadCanonicalProduct(
  productId: string,
  organizationId: string,
): Promise<CanonicalProductRecord | null> {
  const product = await loadProduct(productId, organizationId);
  if (!product) return null;

  const attributes = await resolveProductAttributes(product);

  return {
    product_id: product.id,
    sku: product.sku,
    product_type: product.productType,
    status: product.status,
    title: product.title,
    description: product.description,
    brand: product.brand,
    parent_sku: product.parent?.sku ?? null,
    category_code: product.primaryCategory?.code ?? null,
    category_path: product.primaryCategory?.path ?? null,
    attributes,
  };
}

export async function loadPublishableProductIds(organizationId: string): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: { in: ["APPROVED", "PUBLISH_READY", "PUBLISHED"] },
    },
    select: { id: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  return products.filter((product) => isPublishableStatus(product.status)).map((product) => product.id);
}
