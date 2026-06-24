import type {
  AttributeEntity,
  AttributeGroupEntity,
  CategoryEntity,
  CategoryTreeNode,
} from "@productinfoman/domain";
import type {
  CreateAttributeGroupInput,
  CreateAttributeInput,
  CreateCategoryInput,
  LinkCategoryAttributeGroupsInput,
  LinkCategoryAttributesInput,
  UpdateCategoryInput,
} from "@productinfoman/validation";
import { prisma } from "@productinfoman/db";
import { appError, writeAudit } from "@productinfoman/shared";
import { createEvent } from "@productinfoman/contracts";
import { emitEvent } from "../../lib/events.js";
import { emitAuditRecordEvent } from "../../lib/audit-events.js";

function slugToCode(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
}

function toCategoryDto(c: {
  id: string;
  organizationId: string;
  parentId: string | null;
  code: string;
  name: string;
  slug: string;
  path: string;
  depth: number;
  sortOrder: number;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CategoryEntity {
  return {
    id: c.id,
    organizationId: c.organizationId,
    parentId: c.parentId,
    code: c.code,
    name: c.name,
    slug: c.slug,
    path: c.path,
    depth: c.depth,
    sortOrder: c.sortOrder,
    status: c.status,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function buildCategoryTree(categories: CategoryEntity[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>(
    categories.map((category) => [category.id, { ...category, children: [] }]),
  );
  const roots: CategoryTreeNode[] = [];

  for (const category of categories) {
    const node = byId.get(category.id)!;
    if (category.parentId && byId.has(category.parentId)) {
      byId.get(category.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: CategoryTreeNode[]): CategoryTreeNode[] =>
    nodes
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((node) => ({ ...node, children: sortNodes(node.children) }));

  return sortNodes(roots);
}

async function assertUniqueCategoryCode(
  organizationId: string,
  code: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.category.findFirst({
    where: {
      organizationId,
      code,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw appError(`Category code already exists: ${code}`, 409);
  }
}

async function assertUniqueAttributeGroupCode(
  organizationId: string,
  code: string,
): Promise<void> {
  const existing = await prisma.attributeGroup.findFirst({
    where: { organizationId, code },
    select: { id: true },
  });
  if (existing) {
    throw appError(`Attribute group code already exists: ${code}`, 409);
  }
}

export async function createCategory(
  organizationId: string,
  input: CreateCategoryInput,
): Promise<CategoryEntity> {
  const code = input.code ?? slugToCode(input.slug);
  await assertUniqueCategoryCode(organizationId, code);

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

  const category = await prisma.category.create({
    data: {
      organizationId,
      parentId: input.parentId ?? null,
      code,
      name: input.name,
      slug: input.slug,
      path,
      depth,
      sortOrder: input.sortOrder ?? 0,
      status: input.status ?? "ACTIVE",
    },
  });

  await prisma.categoryAttributeSet.create({ data: { categoryId: category.id } });

  const auditLogId = await writeAudit({
    organizationId,
    entityType: "Category",
    entityId: category.id,
    action: "CREATE",
    changes: { code: category.code, name: category.name, path: category.path },
  });

  await emitAuditRecordEvent({
    organizationId,
    auditLogId,
    entityType: "Category",
    entityId: category.id,
    action: "CREATE",
  });

  await emitEvent(
    createEvent("taxonomy.category.created", organizationId, {
      categoryId: category.id,
      code: category.code,
      name: category.name,
      path: category.path,
    }),
  );

  return toCategoryDto(category);
}

export async function updateCategory(
  id: string,
  organizationId: string,
  input: UpdateCategoryInput,
): Promise<CategoryEntity> {
  const existing = await prisma.category.findFirst({
    where: { id, organizationId },
  });
  if (!existing) throw appError("Category not found", 404);

  let path = existing.path;
  let depth = existing.depth;

  if (input.slug && input.slug !== existing.slug) {
    if (existing.parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: existing.parentId, organizationId },
      });
      path = parent ? `${parent.path}/${input.slug}` : `/${input.slug}`;
    } else {
      path = `/${input.slug}`;
    }
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug, path, depth }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  await writeAudit({
    organizationId,
    entityType: "Category",
    entityId: id,
    action: "UPDATE",
    changes: input as Record<string, unknown>,
  });

  return toCategoryDto(category);
}

export async function listCategories(organizationId: string): Promise<CategoryEntity[]> {
  const categories = await prisma.category.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ depth: "asc" }, { sortOrder: "asc" }],
  });
  return categories.map(toCategoryDto);
}

export async function getCategoryTree(organizationId: string): Promise<CategoryTreeNode[]> {
  const categories = await listCategories(organizationId);
  return buildCategoryTree(categories);
}

export async function createAttributeGroup(
  organizationId: string,
  input: CreateAttributeGroupInput,
): Promise<AttributeGroupEntity> {
  const code = input.code ?? slugToCode(input.name);
  await assertUniqueAttributeGroupCode(organizationId, code);

  const group = await prisma.attributeGroup.create({
    data: {
      organizationId,
      code,
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder ?? 0,
    },
  });

  await writeAudit({
    organizationId,
    entityType: "AttributeGroup",
    entityId: group.id,
    action: "CREATE",
    changes: { code: group.code, name: group.name },
  });

  return {
    id: group.id,
    organizationId: group.organizationId,
    code: group.code,
    name: group.name,
    description: group.description,
    sortOrder: group.sortOrder,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export async function listAttributeGroups(
  organizationId: string,
): Promise<AttributeGroupEntity[]> {
  const groups = await prisma.attributeGroup.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return groups.map((group) => ({
    id: group.id,
    organizationId: group.organizationId,
    code: group.code,
    name: group.name,
    description: group.description,
    sortOrder: group.sortOrder,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  }));
}

export async function createAttribute(
  organizationId: string,
  input: CreateAttributeInput,
): Promise<AttributeEntity> {
  const group = await prisma.attributeGroup.findFirst({
    where: { id: input.attributeGroupId, organizationId },
  });
  if (!group) throw appError("Attribute group not found", 404);

  const existing = await prisma.attributeDefinition.findFirst({
    where: { organizationId, key: input.key },
    select: { id: true },
  });
  if (existing) {
    throw appError(`Attribute key already exists: ${input.key}`, 409);
  }

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
      isRequired: input.isRequired ?? false,
      isFilterable: input.isFilterable ?? false,
      isSearchable: input.isSearchable ?? false,
      allowedValuesType: input.allowedValuesType ?? "FREE_TEXT",
    },
  });

  await writeAudit({
    organizationId,
    entityType: "AttributeDefinition",
    entityId: attr.id,
    action: "CREATE",
    changes: { key: attr.key, label: attr.label },
  });

  return toAttributeDto(attr);
}

function toAttributeDto(a: {
  id: string;
  organizationId: string;
  attributeGroupId: string;
  key: string;
  label: string;
  description: string | null;
  dataType: AttributeEntity["dataType"];
  isGlobal: boolean;
  isVariantAxis: boolean;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  allowedValuesType: AttributeEntity["allowedValuesType"];
  createdAt: Date;
  updatedAt: Date;
}): AttributeEntity {
  return {
    id: a.id,
    organizationId: a.organizationId,
    attributeGroupId: a.attributeGroupId,
    key: a.key,
    label: a.label,
    description: a.description,
    dataType: a.dataType,
    isGlobal: a.isGlobal,
    isVariantAxis: a.isVariantAxis,
    isRequired: a.isRequired,
    isFilterable: a.isFilterable,
    isSearchable: a.isSearchable,
    allowedValuesType: a.allowedValuesType,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function listAttributes(organizationId: string): Promise<AttributeEntity[]> {
  const attrs = await prisma.attributeDefinition.findMany({
    where: { organizationId },
    orderBy: { key: "asc" },
  });

  return attrs.map(toAttributeDto);
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

export async function linkCategoryAttributeGroups(
  categoryId: string,
  organizationId: string,
  input: LinkCategoryAttributeGroupsInput,
): Promise<{ linked: number }> {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, organizationId },
  });
  if (!category) throw appError("Category not found", 404);

  const groups = await prisma.attributeGroup.findMany({
    where: { id: { in: input.attributeGroupIds }, organizationId },
  });
  if (groups.length !== input.attributeGroupIds.length) {
    throw appError("One or more attribute groups not found", 400);
  }

  for (const [index, groupId] of input.attributeGroupIds.entries()) {
    await prisma.categoryAttributeGroup.upsert({
      where: {
        categoryId_attributeGroupId: {
          categoryId,
          attributeGroupId: groupId,
        },
      },
      create: {
        categoryId,
        attributeGroupId: groupId,
        sortOrder: (input.sortOrder ?? 0) + index,
      },
      update: {
        sortOrder: (input.sortOrder ?? 0) + index,
      },
    });
  }

  await writeAudit({
    organizationId,
    entityType: "Category",
    entityId: categoryId,
    action: "UPDATE",
    changes: { linkedAttributeGroups: input.attributeGroupIds },
  });

  return { linked: input.attributeGroupIds.length };
}
