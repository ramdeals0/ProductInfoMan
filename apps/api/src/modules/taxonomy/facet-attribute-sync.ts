import { prisma } from "@productinfoman/db";
import type { ResolvedAttribute } from "@productinfoman/domain";
import { getInheritedFacetCategoryIds } from "./facet-category-scope.js";

export async function loadFacetSourceAttributeMap(
  organizationId: string,
): Promise<Map<string, string>> {
  const facets = await prisma.facetDefinition.findMany({
    where: { organizationId, isActive: true },
    select: {
      key: true,
      sourceAttribute: { select: { key: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return new Map(facets.map((facet) => [facet.key, facet.sourceAttribute.key]));
}

export async function enrichProductAttributesFromFacets(
  organizationId: string,
  categoryId: string | null,
  attributes: ResolvedAttribute[],
): Promise<ResolvedAttribute[]> {
  if (!categoryId) return attributes;

  const inheritedCategoryIds = await getInheritedFacetCategoryIds(organizationId, categoryId);
  if (inheritedCategoryIds.length === 0) return attributes;

  const facets = await prisma.facetDefinition.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [{ categoryId: null, scope: "GLOBAL" }, { categoryId: { in: inheritedCategoryIds } }],
    },
    include: {
      sourceAttribute: { select: { id: true, key: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const byKey = new Map(attributes.map((attribute) => [attribute.key, attribute]));

  for (const facet of facets) {
    const source = facet.sourceAttribute;
    if (!byKey.has(source.key)) {
      byKey.set(source.key, {
        key: source.key,
        attributeDefinitionId: source.id,
        value: null,
        source: "LOCAL",
      });
    }
  }

  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
}
