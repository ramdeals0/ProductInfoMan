import {
  resolveAttributes,
  type StoredAttributeValue,
} from "@productinfoman/inheritance-engine";
import { prisma } from "@productinfoman/db";
import {
  buildSearchDocument,
  type BuildSearchDocumentInput,
  type ProjectionAttributeDefinition,
  type ProjectionAttributeValue,
  type ProjectionCategory,
  type ProjectionFacetDefinition,
} from "@productinfoman/search-projection";
import type { ProductStatus } from "@productinfoman/domain";

type LoadedProduct = NonNullable<Awaited<ReturnType<typeof loadProjectionProduct>>>;

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

function toStoredValues(
  product: LoadedProduct,
): StoredAttributeValue[] {
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

async function resolveProductAttributes(product: LoadedProduct): Promise<ProjectionAttributeValue[]> {
  const categoryId = product.primaryCategoryId;
  const schema = await getEffectiveSchema(product.organizationId, categoryId);
  const schemaForResolve = schema.map((attr) => ({
    id: attr.id,
    key: attr.key,
    inheritFromParent: attr.categoryBindings?.[0]?.inheritFromParent ?? attr.isGlobal,
  }));

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

    return resolveAttributes(schemaForResolve, parentStored, childStored).map((attr) => ({
      key: attr.key,
      attributeDefinitionId: attr.attributeDefinitionId,
      value: attr.value,
    }));
  }

  let stored = toStoredValues(product);
  stored = enrichStoredFromCoreFields(product, schema, stored);
  return stored.map((attr) => ({
    key: attr.key,
    attributeDefinitionId: attr.attributeDefinitionId,
    value: attr.value,
  }));
}

async function loadProjectionProduct(productId: string, organizationId: string) {
  return prisma.product.findFirst({
    where: { id: productId, organizationId, deletedAt: null },
    include: {
      attributeValues: { include: { attributeDefinition: true } },
      parent: true,
      primaryCategory: true,
      secondaryCategories: { include: { category: true } },
    },
  });
}

async function loadPublishedAt(productId: string, status: ProductStatus): Promise<Date | null> {
  if (status !== "PUBLISHED" && status !== "PUBLISH_READY") {
    return null;
  }

  const history = await prisma.workflowHistory.findFirst({
    where: {
      productId,
      toState: "PUBLISHED",
    },
    orderBy: { performedAt: "desc" },
  });

  return history?.performedAt ?? null;
}

async function loadFacetDefinitions(
  organizationId: string,
  categoryId: string | null,
): Promise<ProjectionFacetDefinition[]> {
  const facetKeys = await resolveFacetKeys(organizationId, categoryId ?? undefined);
  if (facetKeys.length === 0) return [];

  const facets = await prisma.facetDefinition.findMany({
    where: {
      organizationId,
      isActive: true,
      key: { in: facetKeys },
    },
    include: { sourceAttribute: true },
    orderBy: { sortOrder: "asc" },
  });

  return facets.map((facet) => ({
    key: facet.key,
    sourceAttributeKey: facet.sourceAttribute.key,
  }));
}

export async function resolveFacetKeys(organizationId: string, categoryId?: string): Promise<string[]> {
  if (!categoryId) {
    const facets = await prisma.facetDefinition.findMany({
      where: {
        organizationId,
        isActive: true,
        categoryId: null,
        scope: "GLOBAL",
      },
      select: { key: true },
      orderBy: { sortOrder: "asc" },
    });
    return facets.map((facet) => facet.key);
  }

  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true, path: true },
  });
  if (!category) return [];

  const descendants = await prisma.category.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [{ id: categoryId }, { path: { startsWith: `${category.path}/` } }],
    },
    select: { id: true },
  });
  const categoryIds = descendants.map((entry) => entry.id);

  const facets = await prisma.facetDefinition.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [{ categoryId: null, scope: "GLOBAL" }, { categoryId: { in: categoryIds } }],
    },
    select: { key: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  const seen = new Set<string>();
  const keys: string[] = [];
  for (const facet of facets) {
    if (seen.has(facet.key)) continue;
    seen.add(facet.key);
    keys.push(facet.key);
  }
  return keys;
}

function toCategory(category: { id: string; path: string } | null | undefined): ProjectionCategory | null {
  if (!category) return null;
  return { id: category.id, path: category.path };
}

export async function buildProductSearchDocument(productId: string, organizationId: string) {
  const product = await loadProjectionProduct(productId, organizationId);
  if (!product) return null;

  const [attributes, facetDefinitions, publishedAt] = await Promise.all([
    resolveProductAttributes(product),
    loadFacetDefinitions(organizationId, product.primaryCategoryId),
    loadPublishedAt(product.id, product.status),
  ]);

  const schema = await getEffectiveSchema(organizationId, product.primaryCategoryId);
  const attributeDefinitions: ProjectionAttributeDefinition[] = schema.map((attr) => ({
    id: attr.id,
    key: attr.key,
    dataType: attr.dataType,
    isVariantAxis: attr.isVariantAxis,
    isFilterable: attr.isFilterable,
    isSearchable: attr.isSearchable,
  }));

  const input: BuildSearchDocumentInput = {
    organizationId,
    productId: product.id,
    sku: product.sku,
    parentProductId: product.parentId,
    productType: product.productType,
    title: product.title,
    brand: product.brand,
    description: product.description,
    summary: product.summary,
    sellingPoints: Array.isArray(product.sellingPoints)
      ? product.sellingPoints.filter((entry): entry is string => typeof entry === "string")
      : [],
    status: product.status,
    publishedAt,
    startDate: product.startDate,
    discontinueDate: product.discontinueDate,
    primaryCategory: toCategory(product.primaryCategory),
    secondaryCategories: product.secondaryCategories
      .map((entry) => toCategory(entry.category))
      .filter((category): category is ProjectionCategory => category != null),
    attributes,
    attributeDefinitions,
    facetDefinitions,
  };

  return buildSearchDocument(input);
}

export async function listIndexableProductIds(organizationId: string): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: { in: ["APPROVED", "PUBLISH_READY", "PUBLISHED"] },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return products.map((product) => product.id);
}
