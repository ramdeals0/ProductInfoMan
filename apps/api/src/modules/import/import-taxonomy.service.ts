import type { ImportJobEntity } from "@productinfoman/domain";
import type { ImportFileType } from "@productinfoman/import-engine";
import {
  buildDefaultAttributeTemplateMappings,
  buildDefaultCategoryTemplateMappings,
  buildDefaultFacetTemplateMappings,
  mergeTaxonomyTemplateMappings,
  normalizeAttributeRow,
  normalizeCategoryRow,
  normalizeFacetRow,
  sortCategoryRowsForCommit,
  TAXONOMY_IMPORT_RECORD_CONFIG,
  validateAttributeImportRows,
  validateCategoryImportRows,
  validateFacetImportRows,
  type NormalizedAttributeImportRow,
  type NormalizedCategoryImportRow,
  type NormalizedFacetImportRow,
  type TaxonomyImportEntityType,
  type TaxonomyImportTemplateMapping,
  type TaxonomyRowValidationError,
} from "@productinfoman/import-engine";
import { prisma } from "@productinfoman/db";
import { appError } from "@productinfoman/shared";
import {
  createAttribute,
  createAttributeGroup,
  createCategory,
  updateAttribute,
  updateCategory,
} from "../taxonomy/taxonomy.service.js";
import {
  createFacetDefinition,
  updateFacetDefinition,
} from "../taxonomy/facet.service.js";

type ParsedImportRow = {
  rowNumber: number;
  data: Record<string, string>;
  rawData: unknown;
};

type ParsedImport = {
  headers: string[];
  rows: ParsedImportRow[];
};

type ImportJobRecord = {
  id: string;
  organizationId: string;
  importType: ImportJobEntity["importType"];
  duplicatePolicy: ImportJobEntity["duplicatePolicy"];
  blankCellPolicy: ImportJobEntity["blankCellPolicy"];
  entityType: ImportJobEntity["entityType"];
};

export function taxonomyDefaultsForEntity(
  entityType: TaxonomyImportEntityType,
): TaxonomyImportTemplateMapping[] {
  switch (entityType) {
    case "CATEGORY":
      return buildDefaultCategoryTemplateMappings();
    case "ATTRIBUTE":
      return buildDefaultAttributeTemplateMappings();
    case "FACET":
      return buildDefaultFacetTemplateMappings();
  }
}

export function mergeTaxonomyMappingsForEntity(
  entityType: TaxonomyImportEntityType,
  mappings: TaxonomyImportTemplateMapping[],
): TaxonomyImportTemplateMapping[] {
  return mergeTaxonomyTemplateMappings(mappings, taxonomyDefaultsForEntity(entityType));
}

export async function validateTaxonomyImportJob(
  job: ImportJobRecord,
  parsed: ParsedImport,
  mappings: TaxonomyImportTemplateMapping[],
): Promise<{
  validRows: number;
  invalidRows: number;
  allErrors: TaxonomyRowValidationError[];
  rowRecords: Array<{
    importJobId: string;
    rowNumber: number;
    rawData: unknown;
    normalizedData?: NormalizedCategoryImportRow | NormalizedAttributeImportRow | NormalizedFacetImportRow;
    status: "VALID" | "INVALID";
  }>;
}> {
  const entityType = job.entityType as TaxonomyImportEntityType;
  const normalizationErrors: TaxonomyRowValidationError[] = [];
  const normalizedRows: Array<
    NormalizedCategoryImportRow | NormalizedAttributeImportRow | NormalizedFacetImportRow
  > = [];

  for (const row of parsed.rows) {
    let normalized:
      | NormalizedCategoryImportRow
      | NormalizedAttributeImportRow
      | NormalizedFacetImportRow
      | null = null;

    if (entityType === "CATEGORY") {
      normalized = normalizeCategoryRow(row.rowNumber, row.data, mappings, job.blankCellPolicy);
      if (!normalized) {
        normalizationErrors.push({
          rowNumber: row.rowNumber,
          fieldName: "code",
          errorCode: "REQUIRED_FIELD",
          errorMessage: "Row is missing required code, name, or slug values",
          rawValue: row.data.code,
        });
      }
    } else if (entityType === "ATTRIBUTE") {
      normalized = normalizeAttributeRow(row.rowNumber, row.data, mappings, job.blankCellPolicy);
      if (!normalized) {
        normalizationErrors.push({
          rowNumber: row.rowNumber,
          fieldName: "key",
          errorCode: "REQUIRED_FIELD",
          errorMessage: "Row is missing required attribute_group_code, key, or label values",
          rawValue: row.data.key,
        });
      }
    } else {
      normalized = normalizeFacetRow(row.rowNumber, row.data, mappings, job.blankCellPolicy);
      if (!normalized) {
        normalizationErrors.push({
          rowNumber: row.rowNumber,
          fieldName: "key",
          errorCode: "REQUIRED_FIELD",
          errorMessage: "Row is missing required key, label, or source_attribute_key values",
          rawValue: row.data.key,
        });
      }
    }

    if (normalized) normalizedRows.push(normalized);
  }

  let validation:
    | ReturnType<typeof validateCategoryImportRows>
    | ReturnType<typeof validateAttributeImportRows>
    | ReturnType<typeof validateFacetImportRows>;

  if (entityType === "CATEGORY") {
    const categories = await prisma.category.findMany({
      where: { organizationId: job.organizationId },
      select: { code: true },
    });
    validation = validateCategoryImportRows(normalizedRows as NormalizedCategoryImportRow[], {
      duplicatePolicy: job.duplicatePolicy,
      importType: job.importType,
      existingCodes: new Set(categories.map((category) => category.code)),
    });
  } else if (entityType === "ATTRIBUTE") {
    const [groups, attributes] = await Promise.all([
      prisma.attributeGroup.findMany({
        where: { organizationId: job.organizationId },
        select: { code: true },
      }),
      prisma.attributeDefinition.findMany({
        where: { organizationId: job.organizationId },
        select: { key: true },
      }),
    ]);
    const attributeGroupCodesInFile = new Set(
      (normalizedRows as NormalizedAttributeImportRow[]).map((row) => row.attributeGroupCode),
    );
    validation = validateAttributeImportRows(normalizedRows as NormalizedAttributeImportRow[], {
      duplicatePolicy: job.duplicatePolicy,
      importType: job.importType,
      existingKeys: new Set(attributes.map((attribute) => attribute.key)),
      attributeGroupCodes: new Set(groups.map((group) => group.code)),
      attributeGroupCodesInFile,
    });
  } else {
    const [facets, attributes, categories] = await Promise.all([
      prisma.facetDefinition.findMany({
        where: { organizationId: job.organizationId },
        select: { key: true },
      }),
      prisma.attributeDefinition.findMany({
        where: { organizationId: job.organizationId },
        select: { key: true },
      }),
      prisma.category.findMany({
        where: { organizationId: job.organizationId, isActive: true },
        select: { code: true },
      }),
    ]);
    validation = validateFacetImportRows(normalizedRows as NormalizedFacetImportRow[], {
      duplicatePolicy: job.duplicatePolicy,
      importType: job.importType,
      existingKeys: new Set(facets.map((facet) => facet.key)),
      attributeKeys: new Set(attributes.map((attribute) => attribute.key)),
      categoryCodes: new Set(categories.map((category) => category.code)),
    });
  }

  const allErrors = [...normalizationErrors, ...validation.errors];
  const rowRecords = parsed.rows.map((row) => {
    const normalized = normalizedRows.find((item) => item.rowNumber === row.rowNumber);
    const isValid = validation.validRows.some((item) => item.rowNumber === row.rowNumber);
    return {
      importJobId: job.id,
      rowNumber: row.rowNumber,
      rawData: row.rawData as object,
      normalizedData: normalized,
      status: isValid ? ("VALID" as const) : ("INVALID" as const),
    };
  });

  return {
    validRows: validation.validRows.length,
    invalidRows: parsed.rows.length - validation.validRows.length,
    allErrors,
    rowRecords,
  };
}

export async function processTaxonomyImportJob(
  job: ImportJobRecord,
): Promise<{ committedRows: number; skippedRows: number }> {
  const entityType = job.entityType as TaxonomyImportEntityType;
  const rows = await prisma.importJobRow.findMany({
    where: { importJobId: job.id, status: "VALID" },
    orderBy: { rowNumber: "asc" },
  });

  let committedRows = 0;
  let skippedRows = 0;

  if (entityType === "CATEGORY") {
    const normalizedRows = rows
      .map((row) => row.normalizedData as NormalizedCategoryImportRow | null)
      .filter((row): row is NormalizedCategoryImportRow => row !== null);
    const sortedRows = sortCategoryRowsForCommit(normalizedRows);

    const categories = await prisma.category.findMany({
      where: { organizationId: job.organizationId },
      select: { id: true, code: true },
    });
    const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]));

    for (const row of sortedRows) {
      const dbRow = rows.find((item) => item.rowNumber === row.rowNumber);
      if (!dbRow) continue;

      const parentId = row.parentCode ? categoryIdByCode.get(row.parentCode) : undefined;
      if (row.parentCode && !parentId) {
        skippedRows++;
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "SKIPPED" },
        });
        continue;
      }

      const existingId = categoryIdByCode.get(row.code);
      if (existingId && (job.importType === "UPDATE" || job.importType === "UPSERT")) {
        await updateCategory(existingId, job.organizationId, {
          name: row.name,
          slug: row.slug,
          sortOrder: row.sortOrder,
          status: row.status,
          isActive: row.status === "ACTIVE",
        });
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "COMMITTED", entityId: existingId },
        });
        committedRows++;
        continue;
      }

      if (existingId) {
        skippedRows++;
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "SKIPPED" },
        });
        continue;
      }

      const created = await createCategory(job.organizationId, {
        name: row.name,
        code: row.code,
        slug: row.slug,
        parentId: parentId ?? null,
        sortOrder: row.sortOrder,
        status: row.status,
      });
      categoryIdByCode.set(row.code, created.id);
      await prisma.importJobRow.update({
        where: { id: dbRow.id },
        data: { status: "COMMITTED", entityId: created.id },
      });
      committedRows++;
    }
  } else if (entityType === "ATTRIBUTE") {
    const groups = await prisma.attributeGroup.findMany({
      where: { organizationId: job.organizationId },
      select: { id: true, code: true },
    });
    const groupIdByCode = new Map(groups.map((group) => [group.code, group.id]));

    const attributes = await prisma.attributeDefinition.findMany({
      where: { organizationId: job.organizationId },
      select: { id: true, key: true },
    });
    const attributeIdByKey = new Map(attributes.map((attribute) => [attribute.key, attribute.id]));

    for (const dbRow of rows) {
      const row = dbRow.normalizedData as NormalizedAttributeImportRow | null;
      if (!row) continue;

      let groupId = groupIdByCode.get(row.attributeGroupCode);
      if (!groupId) {
        const createdGroup = await createAttributeGroup(job.organizationId, {
          code: row.attributeGroupCode,
          name: row.attributeGroupCode,
        });
        groupId = createdGroup.id;
        groupIdByCode.set(row.attributeGroupCode, groupId);
      }

      const existingId = attributeIdByKey.get(row.key);
      if (existingId && (job.importType === "UPDATE" || job.importType === "UPSERT")) {
        await updateAttribute(existingId, job.organizationId, {
          label: row.label,
          description: row.description,
          isGlobal: row.isGlobal,
          isVariantAxis: row.isVariantAxis,
          isRequired: row.isRequired,
          isFilterable: row.isFilterable,
          isSearchable: row.isSearchable,
          allowedValuesType: row.allowedValuesType,
        });
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "COMMITTED", entityId: existingId },
        });
        committedRows++;
        continue;
      }

      if (existingId) {
        skippedRows++;
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "SKIPPED" },
        });
        continue;
      }

      const created = await createAttribute(job.organizationId, {
        attributeGroupId: groupId,
        key: row.key,
        label: row.label,
        description: row.description,
        dataType: row.dataType,
        isGlobal: row.isGlobal,
        isVariantAxis: row.isVariantAxis,
        isRequired: row.isRequired,
        isFilterable: row.isFilterable,
        isSearchable: row.isSearchable,
        allowedValuesType: row.allowedValuesType,
      });
      attributeIdByKey.set(row.key, created.id);
      await prisma.importJobRow.update({
        where: { id: dbRow.id },
        data: { status: "COMMITTED", entityId: created.id },
      });
      committedRows++;
    }
  } else {
    const [attributes, categories, facets] = await Promise.all([
      prisma.attributeDefinition.findMany({
        where: { organizationId: job.organizationId },
        select: { id: true, key: true },
      }),
      prisma.category.findMany({
        where: { organizationId: job.organizationId },
        select: { id: true, code: true },
      }),
      prisma.facetDefinition.findMany({
        where: { organizationId: job.organizationId },
        select: { id: true, key: true },
      }),
    ]);
    const attributeIdByKey = new Map(attributes.map((attribute) => [attribute.key, attribute.id]));
    const categoryIdByCode = new Map(categories.map((category) => [category.code, category.id]));
    const facetIdByKey = new Map(facets.map((facet) => [facet.key, facet.id]));

    for (const dbRow of rows) {
      const row = dbRow.normalizedData as NormalizedFacetImportRow | null;
      if (!row) continue;

      const sourceAttributeId = attributeIdByKey.get(row.sourceAttributeKey);
      if (!sourceAttributeId) {
        skippedRows++;
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "SKIPPED" },
        });
        continue;
      }

      const categoryId = row.categoryCode ? categoryIdByCode.get(row.categoryCode) : undefined;
      if (row.categoryCode && !categoryId) {
        skippedRows++;
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "SKIPPED" },
        });
        continue;
      }

      const existingId = facetIdByKey.get(row.key);
      if (existingId && (job.importType === "UPDATE" || job.importType === "UPSERT")) {
        await updateFacetDefinition(existingId, job.organizationId, {
          label: row.label,
          sortOrder: row.sortOrder,
          isDynamic: row.isDynamic,
          isActive: row.isActive,
          categoryId: categoryId ?? null,
        });
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "COMMITTED", entityId: existingId },
        });
        committedRows++;
        continue;
      }

      if (existingId) {
        skippedRows++;
        await prisma.importJobRow.update({
          where: { id: dbRow.id },
          data: { status: "SKIPPED" },
        });
        continue;
      }

      const created = await createFacetDefinition(job.organizationId, {
        key: row.key,
        label: row.label,
        sourceAttributeId,
        categoryId: categoryId ?? null,
        sortOrder: row.sortOrder,
        isDynamic: row.isDynamic,
        isActive: row.isActive,
      });
      facetIdByKey.set(row.key, created.id);
      await prisma.importJobRow.update({
        where: { id: dbRow.id },
        data: { status: "COMMITTED", entityId: created.id },
      });
      committedRows++;
    }
  }

  return { committedRows, skippedRows };
}

export function taxonomyParseOptions(
  entityType: TaxonomyImportEntityType,
  fileType: ImportFileType,
): { jsonRootKeys?: string[]; xmlRecordElement?: string } {
  const config = TAXONOMY_IMPORT_RECORD_CONFIG[entityType];
  if (fileType === "JSON") return { jsonRootKeys: config.jsonRootKeys };
  if (fileType === "XML") return { xmlRecordElement: config.xmlRecordElement };
  return {};
}

export function isTaxonomyImportEntity(
  entityType: ImportJobEntity["entityType"],
): entityType is TaxonomyImportEntityType {
  return entityType === "CATEGORY" || entityType === "ATTRIBUTE" || entityType === "FACET";
}

export function normalizeImportEntityType(
  entityType?: ImportJobEntity["entityType"] | null,
): ImportJobEntity["entityType"] {
  if (!entityType || entityType === "VARIANT") return "PRODUCT";
  return entityType;
}

export async function resolveUploadEntityType(
  organizationId: string,
  input: { entityType?: ImportJobEntity["entityType"]; importTemplateId?: string },
): Promise<ImportJobEntity["entityType"]> {
  if (input.importTemplateId) {
    const template = await prisma.importTemplate.findFirst({
      where: { id: input.importTemplateId, organizationId },
      select: { entityType: true },
    });
    if (!template) throw appError("Import template not found", 404);
    return normalizeImportEntityType(template.entityType);
  }
  return normalizeImportEntityType(input.entityType);
}
