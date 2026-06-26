import { getCategoryPathPrefixes } from "@productinfoman/facet-engine";
import { prisma } from "@productinfoman/db";

export async function getCategoryAncestorIds(
  organizationId: string,
  categoryId: string,
): Promise<string[]> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
    select: { path: true },
  });
  if (!category) return [];

  const ancestorPaths = getCategoryPathPrefixes(category.path);
  const ancestors = await prisma.category.findMany({
    where: {
      organizationId,
      isActive: true,
      path: { in: ancestorPaths },
    },
    select: { id: true },
    orderBy: { depth: "asc" },
  });

  return ancestors.map((entry) => entry.id);
}

export async function getInheritedFacetCategoryIds(
  organizationId: string,
  categoryId?: string,
): Promise<string[]> {
  if (!categoryId) return [];
  return getCategoryAncestorIds(organizationId, categoryId);
}
