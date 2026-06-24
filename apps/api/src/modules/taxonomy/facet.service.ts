import type {
  CategoryFacetEntity,
  FacetDefinitionEntity,
  FacetRuleEntity,
} from "@productinfoman/domain";
import type {
  CreateFacetDefinitionInput,
  CreateFacetRuleInput,
  ListFacetDefinitionsQuery,
  ListFacetRulesQuery,
} from "@productinfoman/validation";
import { resolveCategoryFacets } from "@productinfoman/facet-engine";
import { prisma } from "@productinfoman/db";
import { appError, writeAudit } from "@productinfoman/shared";
import type { Prisma } from "../../../../generated/prisma/client.js";

async function assertUniqueFacetKey(
  organizationId: string,
  key: string,
): Promise<void> {
  const existing = await prisma.facetDefinition.findFirst({
    where: { organizationId, key },
    select: { id: true },
  });
  if (existing) {
    throw appError(`Facet definition key already exists: ${key}`, 409);
  }
}

function toFacetDefinitionDto(facet: {
  id: string;
  organizationId: string;
  key: string;
  label: string;
  sourceAttributeId: string;
  categoryId: string | null;
  scope: "GLOBAL" | "CATEGORY";
  sortOrder: number;
  isDynamic: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sourceAttribute: { key: string };
}): FacetDefinitionEntity {
  return {
    id: facet.id,
    organizationId: facet.organizationId,
    key: facet.key,
    label: facet.label,
    sourceAttributeId: facet.sourceAttributeId,
    sourceAttributeKey: facet.sourceAttribute.key,
    categoryId: facet.categoryId,
    scope: facet.scope,
    sortOrder: facet.sortOrder,
    isDynamic: facet.isDynamic,
    isActive: facet.isActive,
    createdAt: facet.createdAt.toISOString(),
    updatedAt: facet.updatedAt.toISOString(),
  };
}

function toFacetRuleDto(rule: {
  id: string;
  organizationId: string;
  categoryId: string | null;
  attributeDefinitionId: string | null;
  facetDefinitionId: string;
  ruleType: FacetRuleEntity["ruleType"];
  ruleConfig: Prisma.JsonValue;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}): FacetRuleEntity {
  return {
    id: rule.id,
    organizationId: rule.organizationId,
    categoryId: rule.categoryId,
    attributeDefinitionId: rule.attributeDefinitionId,
    facetDefinitionId: rule.facetDefinitionId,
    ruleType: rule.ruleType,
    ruleConfig:
      rule.ruleConfig && typeof rule.ruleConfig === "object" && !Array.isArray(rule.ruleConfig)
        ? (rule.ruleConfig as Record<string, unknown>)
        : null,
    priority: rule.priority,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export async function createFacetDefinition(
  organizationId: string,
  input: CreateFacetDefinitionInput,
): Promise<FacetDefinitionEntity> {
  await assertUniqueFacetKey(organizationId, input.key);

  const sourceAttribute = await prisma.attributeDefinition.findFirst({
    where: { id: input.sourceAttributeId, organizationId },
  });
  if (!sourceAttribute) {
    throw appError("Source attribute not found", 404);
  }

  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, organizationId },
    });
    if (!category) throw appError("Category not found", 404);
  }

  const facet = await prisma.facetDefinition.create({
    data: {
      organizationId,
      key: input.key,
      label: input.label,
      sourceAttributeId: input.sourceAttributeId,
      categoryId: input.categoryId ?? null,
      scope: input.categoryId ? "CATEGORY" : "GLOBAL",
      sortOrder: input.sortOrder ?? 0,
      isDynamic: input.isDynamic ?? false,
      isActive: input.isActive ?? true,
    },
    include: { sourceAttribute: { select: { key: true } } },
  });

  if (sourceAttribute.allowedValuesType === "CONTROLLED_LIST") {
    const enumValues = await prisma.attributeEnumValue.findMany({
      where: { attributeDefinitionId: sourceAttribute.id },
      orderBy: { sortOrder: "asc" },
    });

    for (const enumValue of enumValues) {
      await prisma.facetValue.upsert({
        where: {
          facetDefinitionId_value: {
            facetDefinitionId: facet.id,
            value: enumValue.value,
          },
        },
        create: {
          facetDefinitionId: facet.id,
          value: enumValue.value,
          label: enumValue.label,
          sortOrder: enumValue.sortOrder,
          sourceEnumValueId: enumValue.id,
        },
        update: {
          label: enumValue.label,
          sortOrder: enumValue.sortOrder,
          sourceEnumValueId: enumValue.id,
        },
      });
    }
  }

  await writeAudit({
    organizationId,
    entityType: "FacetDefinition",
    entityId: facet.id,
    action: "CREATE",
    changes: { key: facet.key, sourceAttributeId: facet.sourceAttributeId },
  });

  return toFacetDefinitionDto(facet);
}

export async function listFacetDefinitions(
  organizationId: string,
  query: ListFacetDefinitionsQuery = {},
): Promise<FacetDefinitionEntity[]> {
  const facets = await prisma.facetDefinition.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(query.categoryId
        ? {
            OR: [{ categoryId: query.categoryId }, { categoryId: null, scope: "GLOBAL" }],
          }
        : {}),
    },
    include: { sourceAttribute: { select: { key: true } } },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  });

  return facets.map(toFacetDefinitionDto);
}

export async function createFacetRule(
  organizationId: string,
  input: CreateFacetRuleInput,
): Promise<FacetRuleEntity> {
  const facet = await prisma.facetDefinition.findFirst({
    where: { id: input.facetDefinitionId, organizationId },
  });
  if (!facet) throw appError("Facet definition not found", 404);

  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, organizationId },
    });
    if (!category) throw appError("Category not found", 404);

    if (facet.categoryId && facet.categoryId !== input.categoryId) {
      throw appError("Facet definition is scoped to a different category", 400);
    }
  }

  const attributeId = input.attributeDefinitionId ?? facet.sourceAttributeId;
  if (attributeId !== facet.sourceAttributeId) {
    throw appError("Facet rule attribute must match the facet source attribute", 400);
  }

  const attribute = await prisma.attributeDefinition.findFirst({
    where: { id: attributeId, organizationId },
  });
  if (!attribute) throw appError("Attribute not found", 400);

  const rule = await prisma.facetRule.create({
    data: {
      organizationId,
      categoryId: input.categoryId ?? facet.categoryId,
      attributeDefinitionId: attributeId,
      facetDefinitionId: facet.id,
      ruleType: input.ruleType,
      ruleConfig: input.ruleConfig ?? undefined,
      priority: input.priority ?? 0,
    },
  });

  await writeAudit({
    organizationId,
    entityType: "FacetRule",
    entityId: rule.id,
    action: "CREATE",
    changes: {
      facetDefinitionId: rule.facetDefinitionId,
      categoryId: rule.categoryId,
      ruleType: rule.ruleType,
    },
  });

  return toFacetRuleDto(rule);
}

export async function listFacetRules(
  organizationId: string,
  query: ListFacetRulesQuery = {},
): Promise<FacetRuleEntity[]> {
  const rules = await prisma.facetRule.findMany({
    where: {
      organizationId,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.facetDefinitionId ? { facetDefinitionId: query.facetDefinitionId } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return rules.map(toFacetRuleDto);
}

export async function getCategoryFacets(
  categoryId: string,
  organizationId: string,
): Promise<CategoryFacetEntity[]> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
  });
  if (!category) throw appError("Category not found", 404);

  const facets = await prisma.facetDefinition.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [{ categoryId }, { categoryId: null, scope: "GLOBAL" }],
    },
    include: {
      sourceAttribute: {
        include: {
          enumValues: { orderBy: { sortOrder: "asc" } },
        },
      },
      values: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      rules: {
        where: {
          OR: [{ categoryId }, { categoryId: null }],
        },
        orderBy: { priority: "desc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const resolved = resolveCategoryFacets(
    facets.map((facet) => ({
      key: facet.key,
      label: facet.label,
      sourceAttributeKey: facet.sourceAttribute.key,
      isDynamic: facet.isDynamic,
      sortOrder: facet.sortOrder,
      rules: facet.rules.map((rule) => ({
        ruleType: rule.ruleType,
        ruleConfig:
          rule.ruleConfig && typeof rule.ruleConfig === "object" && !Array.isArray(rule.ruleConfig)
            ? (rule.ruleConfig as Record<string, unknown>)
            : null,
        priority: rule.priority,
      })),
      facetValues: facet.values.map((value) => ({
        value: value.value,
        label: value.label,
        sortOrder: value.sortOrder,
        isActive: value.isActive,
      })),
      enumValues: facet.sourceAttribute.enumValues.map((value) => ({
        value: value.value,
        label: value.label,
        sortOrder: value.sortOrder,
      })),
    })),
  );

  return resolved;
}
