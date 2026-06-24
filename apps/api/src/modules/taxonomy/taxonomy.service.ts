import type {
  AttributeEntity,
  AttributeGroupEntity,
  CategoryEntity,
} from "@productinfoman/domain";
import type {
  CreateAttributeGroupInput,
  CreateAttributeInput,
  CreateCategoryInput,
  LinkCategoryAttributesInput,
} from "@productinfoman/validation";
import { prisma } from "@productinfoman/db";
import { appError, writeAudit } from "@productinfoman/shared";

function toCategoryDto(c: {
  id: string;
  organizationId: string;
  parentId: string | null;
  name: string;
  slug: string;
  path: string;
  depth: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CategoryEntity {
  return {
    id: c.id,
    organizationId: c.organizationId,
    parentId: c.parentId,
    name: c.name,
    slug: c.slug,
    path: c.path,
    depth: c.depth,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function createCategory(
  organizationId: string,
  input: CreateCategoryInput,
): Promise<CategoryEntity> {
  let path = `/${input.slug}`;
  let depth = 0;

  if (input.parentId) {
    const parent = await prisma.category.findFirst({
      where: { id: input.parentId, organizationId },
    });
    if (!parent) throw appError("Parent category not found", 404);
    path = `${parent.path}/${input.slug}`;
    depth = parent.depth + 1;
  }

  try {
    const category = await prisma.category.create({
      data: {
        organizationId,
        parentId: input.parentId ?? null,
        name: input.name,
        slug: input.slug,
        path,
        depth,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await prisma.categoryAttributeSet.create({ data: { categoryId: category.id } });

    await writeAudit({
      organizationId,
      entityType: "Category",
      entityId: category.id,
      action: "CREATE",
      changes: { name: category.name, path: category.path },
    });

    return toCategoryDto(category);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      throw appError("Category path or slug already exists", 409);
    }
    throw e;
  }
}

export async function listCategories(organizationId: string): Promise<CategoryEntity[]> {
  const categories = await prisma.category.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ depth: "asc" }, { sortOrder: "asc" }],
  });
  return categories.map(toCategoryDto);
}

export async function createAttributeGroup(
  organizationId: string,
  input: CreateAttributeGroupInput,
): Promise<AttributeGroupEntity> {
  try {
    const group = await prisma.attributeGroup.create({
      data: {
        organizationId,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await writeAudit({
      organizationId,
      entityType: "AttributeGroup",
      entityId: group.id,
      action: "CREATE",
      changes: { name: group.name },
    });

    return {
      id: group.id,
      organizationId: group.organizationId,
      name: group.name,
      sortOrder: group.sortOrder,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      throw appError("Attribute group name already exists", 409);
    }
    throw e;
  }
}

export async function createAttribute(
  organizationId: string,
  input: CreateAttributeInput,
): Promise<AttributeEntity> {
  const group = await prisma.attributeGroup.findFirst({
    where: { id: input.attributeGroupId, organizationId },
  });
  if (!group) throw appError("Attribute group not found", 404);

  try {
    const attr = await prisma.attributeDefinition.create({
      data: {
        organizationId,
        attributeGroupId: input.attributeGroupId,
        key: input.key,
        label: input.label,
        description: input.description,
        dataType: input.dataType,
        isGlobal: input.isGlobal ?? false,
        isVariantAxis: input.isVariantAxis ?? false,
      },
    });

    await writeAudit({
      organizationId,
      entityType: "AttributeDefinition",
      entityId: attr.id,
      action: "CREATE",
      changes: { key: attr.key, label: attr.label },
    });

    return {
      id: attr.id,
      organizationId: attr.organizationId,
      attributeGroupId: attr.attributeGroupId,
      key: attr.key,
      label: attr.label,
      description: attr.description,
      dataType: attr.dataType,
      isGlobal: attr.isGlobal,
      isVariantAxis: attr.isVariantAxis,
      createdAt: attr.createdAt.toISOString(),
      updatedAt: attr.updatedAt.toISOString(),
    };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      throw appError("Attribute key already exists", 409);
    }
    throw e;
  }
}

export async function listAttributes(organizationId: string): Promise<AttributeEntity[]> {
  const attrs = await prisma.attributeDefinition.findMany({
    where: { organizationId },
    orderBy: { key: "asc" },
  });

  return attrs.map((a) => ({
    id: a.id,
    organizationId: a.organizationId,
    attributeGroupId: a.attributeGroupId,
    key: a.key,
    label: a.label,
    description: a.description,
    dataType: a.dataType,
    isGlobal: a.isGlobal,
    isVariantAxis: a.isVariantAxis,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));
}

export async function linkCategoryAttributes(
  categoryId: string,
  organizationId: string,
  input: LinkCategoryAttributesInput,
): Promise<{ linked: number }> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
    include: { attributeSet: true },
  });
  if (!category?.attributeSet) throw appError("Category not found", 404);

  const attrs = await prisma.attributeDefinition.findMany({
    where: { id: { in: input.attributeDefinitionIds }, organizationId },
  });
  if (attrs.length !== input.attributeDefinitionIds.length) {
    throw appError("One or more attributes not found", 400);
  }

  for (const attrId of input.attributeDefinitionIds) {
    await prisma.categoryAttributeBinding.upsert({
      where: {
        categoryAttributeSetId_attributeDefinitionId: {
          categoryAttributeSetId: category.attributeSet.id,
          attributeDefinitionId: attrId,
        },
      },
      create: {
        categoryAttributeSetId: category.attributeSet.id,
        attributeDefinitionId: attrId,
        requirement: input.requirement,
        inheritFromParent: input.inheritFromParent,
      },
      update: {
        requirement: input.requirement,
        inheritFromParent: input.inheritFromParent,
      },
    });
  }

  await writeAudit({
    organizationId,
    entityType: "Category",
    entityId: categoryId,
    action: "UPDATE",
    changes: { linkedAttributes: input.attributeDefinitionIds },
  });

  return { linked: input.attributeDefinitionIds.length };
}
