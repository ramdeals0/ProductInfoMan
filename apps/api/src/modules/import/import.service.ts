import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ImportJobEntity,
  ImportJobErrorEntity,
  ImportRunSummaryEntity,
  ImportTemplateEntity,
} from "@productinfoman/domain";
import type {
  CreateImportTemplateInput,
  ListImportsQuery,
  UploadImportInput,
} from "@productinfoman/validation";
import {
  buildErrorReportCsv,
  normalizeRow,
  parseCsv,
  validateImportRows,
  type NormalizedImportRow,
  type RowValidationError,
  type TemplateMapping,
} from "@productinfoman/import-engine";
import { prisma } from "@productinfoman/db";
import { appError, writeAudit } from "@productinfoman/shared";
import { createEvent } from "@productinfoman/contracts";
import { emitEvent } from "../../lib/events.js";
import { emitAuditRecordEvent } from "../../lib/audit-events.js";
import { createProduct, setProductAttributes } from "../product-core/product.service.js";
import { enqueueImportJob } from "./import.queue.js";

const UPLOAD_ROOT = path.resolve(process.cwd(), "../../uploads");

const DEFAULT_REQUIRED_FIELDS = {
  SIMPLE: ["sku", "product_type", "title"],
  PARENT: ["sku", "product_type", "title"],
  VARIANT: ["sku", "product_type", "parent_sku"],
} as const;

function toImportJobDto(job: {
  id: string;
  organizationId: string;
  importTemplateId: string | null;
  fileName: string;
  filePath: string;
  importType: ImportJobEntity["importType"];
  status: ImportJobEntity["status"];
  duplicatePolicy: ImportJobEntity["duplicatePolicy"];
  blankCellPolicy: ImportJobEntity["blankCellPolicy"];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  committedRows: number;
  createdById: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ImportJobEntity {
  return {
    id: job.id,
    organizationId: job.organizationId,
    importTemplateId: job.importTemplateId,
    fileName: job.fileName,
    filePath: job.filePath,
    importType: job.importType,
    status: job.status,
    duplicatePolicy: job.duplicatePolicy,
    blankCellPolicy: job.blankCellPolicy,
    totalRows: job.totalRows,
    validRows: job.validRows,
    invalidRows: job.invalidRows,
    committedRows: job.committedRows,
    createdById: job.createdById,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

async function loadTemplateMappings(
  organizationId: string,
  importTemplateId?: string | null,
): Promise<TemplateMapping[]> {
  if (importTemplateId) {
    const template = await prisma.importTemplate.findFirst({
      where: { id: importTemplateId, organizationId },
      include: { mappings: { orderBy: { sortOrder: "asc" } } },
    });
    if (!template) throw appError("Import template not found", 404);
    return template.mappings.map((mapping) => ({
      sourceColumn: mapping.sourceColumn,
      targetField: mapping.targetField,
      isRequired: mapping.isRequired,
    }));
  }

  const defaultTemplate = await prisma.importTemplate.findFirst({
    where: { organizationId, isDefault: true },
    include: { mappings: { orderBy: { sortOrder: "asc" } } },
  });
  if (defaultTemplate) {
    return defaultTemplate.mappings.map((mapping) => ({
      sourceColumn: mapping.sourceColumn,
      targetField: mapping.targetField,
      isRequired: mapping.isRequired,
    }));
  }

  return [
    { sourceColumn: "sku", targetField: "sku", isRequired: true },
    { sourceColumn: "product_type", targetField: "product_type", isRequired: true },
    { sourceColumn: "title", targetField: "title", isRequired: true },
    { sourceColumn: "description", targetField: "description" },
    { sourceColumn: "brand", targetField: "brand" },
    { sourceColumn: "parent_sku", targetField: "parent_sku" },
    { sourceColumn: "category_code", targetField: "category_code" },
    { sourceColumn: "color", targetField: "color" },
    { sourceColumn: "size", targetField: "size" },
  ];
}

async function buildValidationContext(organizationId: string, job: {
  duplicatePolicy: "REJECT" | "UPDATE" | "SKIP";
  importType: "CREATE" | "UPDATE" | "UPSERT";
}) {
  const [products, categories, attributes, rules] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, deletedAt: null },
      select: { sku: true, productType: true },
    }),
    prisma.category.findMany({
      where: { organizationId, isActive: true },
      select: { code: true },
    }),
    prisma.attributeDefinition.findMany({
      where: { organizationId },
      select: { key: true },
    }),
    prisma.validationRule.findMany({
      where: { organizationId, isActive: true, entityType: "PRODUCT" },
    }),
  ]);

  const requiredFieldsByType: Partial<
    Record<"SIMPLE" | "PARENT" | "VARIANT", string[]>
  > = {
    SIMPLE: [...DEFAULT_REQUIRED_FIELDS.SIMPLE],
    PARENT: [...DEFAULT_REQUIRED_FIELDS.PARENT],
    VARIANT: [...DEFAULT_REQUIRED_FIELDS.VARIANT],
  };

  for (const rule of rules) {
    if (rule.ruleType !== "REQUIRED_FIELD") continue;
    const config = rule.ruleConfig as { productType?: string; fields?: string[] } | null;
    if (config?.productType && config.fields) {
      requiredFieldsByType[config.productType as "SIMPLE" | "PARENT" | "VARIANT"] =
        config.fields;
    }
  }

  return {
    duplicatePolicy: job.duplicatePolicy,
    importType: job.importType,
    existingSkus: new Set(products.map((product) => product.sku)),
    parentSkusInDb: new Set(
      products.filter((product) => product.productType === "PARENT").map((product) => product.sku),
    ),
    categoryCodes: new Set(categories.map((category) => category.code)),
    attributeKeys: new Set(attributes.map((attribute) => attribute.key)),
    requiredFieldsByType,
  };
}

export async function uploadImport(
  organizationId: string,
  input: UploadImportInput & { fileName: string; fileBuffer: Buffer },
): Promise<ImportJobEntity> {
  const job = await prisma.importJob.create({
    data: {
      organizationId,
      importTemplateId: input.importTemplateId,
      fileName: input.fileName,
      filePath: "",
      importType: input.importType ?? "CREATE",
      duplicatePolicy: input.duplicatePolicy ?? "REJECT",
      blankCellPolicy: input.blankCellPolicy ?? "IGNORE",
      status: "UPLOADED",
    },
  });

  const dir = path.join(UPLOAD_ROOT, organizationId, job.id);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, input.fileName);
  await writeFile(filePath, input.fileBuffer);

  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: { filePath },
  });

  await writeAudit({
    organizationId,
    entityType: "ImportJob",
    entityId: job.id,
    action: "IMPORT",
    source: "import",
    changes: { fileName: input.fileName, importType: updated.importType },
  });

  return toImportJobDto(updated);
}

export async function validateImport(
  importJobId: string,
  organizationId: string,
): Promise<ImportJobEntity> {
  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, organizationId },
  });
  if (!job) throw appError("Import job not found", 404);
  if (!["UPLOADED", "VALIDATION_FAILED", "VALIDATED"].includes(job.status)) {
    throw appError(`Import job cannot be validated in status ${job.status}`, 400);
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "VALIDATING" },
  });

  const [csvContent, mappings, context] = await Promise.all([
    readFile(job.filePath, "utf8"),
    loadTemplateMappings(organizationId, job.importTemplateId),
    buildValidationContext(organizationId, job),
  ]);

  const parsed = parseCsv(csvContent);
  const normalizationErrors: RowValidationError[] = [];
  const normalizedRows: NormalizedImportRow[] = [];

  for (const row of parsed.rows) {
    const normalized = normalizeRow(row.rowNumber, row.data, mappings, job.blankCellPolicy);
    if (!normalized) {
      normalizationErrors.push({
        rowNumber: row.rowNumber,
        fieldName: "sku",
        errorCode: "REQUIRED_FIELD",
        errorMessage: "Row is missing required sku or product_type values",
        rawValue: row.data.sku ?? row.data.product_type,
      });
      continue;
    }
    normalizedRows.push(normalized);
  }

  const validation = validateImportRows(normalizedRows, context);
  const allErrors = [...normalizationErrors, ...validation.errors];

  await prisma.importJobRow.deleteMany({ where: { importJobId: job.id } });
  await prisma.importJobError.deleteMany({ where: { importJobId: job.id } });

  const rowRecords = parsed.rows.map((row) => {
    const normalized = normalizedRows.find((item) => item.rowNumber === row.rowNumber);
    const isValid = validation.validRows.some((item) => item.rowNumber === row.rowNumber);
    return {
      importJobId: job.id,
      rowNumber: row.rowNumber,
      rawData: row.data,
      normalizedData: normalized ?? undefined,
      status: isValid ? ("VALID" as const) : ("INVALID" as const),
    };
  });

  if (rowRecords.length > 0) {
    await prisma.importJobRow.createMany({ data: rowRecords });
  }

  if (allErrors.length > 0) {
    await prisma.importJobError.createMany({
      data: allErrors.map((error) => ({
        importJobId: job.id,
        rowNumber: error.rowNumber,
        fieldName: error.fieldName,
        errorCode: error.errorCode,
        errorMessage: error.errorMessage,
        rawValue: error.rawValue,
      })),
    });
  }

  const validRows = validation.validRows.length;
  const invalidRows = parsed.rows.length - validRows;
  const status = invalidRows > 0 && validRows === 0 ? "VALIDATION_FAILED" : "VALIDATED";

  await prisma.importRunSummary.upsert({
    where: { importJobId: job.id },
    create: {
      importJobId: job.id,
      totalRows: parsed.rows.length,
      validRows,
      invalidRows,
      duplicateRows: allErrors.filter((error) => error.errorCode === "DUPLICATE_KEY").length,
      summaryJson: {
        headers: parsed.headers,
        errorCodes: [...new Set(allErrors.map((error) => error.errorCode))],
      },
    },
    update: {
      totalRows: parsed.rows.length,
      validRows,
      invalidRows,
      duplicateRows: allErrors.filter((error) => error.errorCode === "DUPLICATE_KEY").length,
      summaryJson: {
        headers: parsed.headers,
        errorCodes: [...new Set(allErrors.map((error) => error.errorCode))],
      },
    },
  });

  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status,
      totalRows: parsed.rows.length,
      validRows,
      invalidRows,
    },
  });

  return toImportJobDto(updated);
}

export async function startImport(
  importJobId: string,
  organizationId: string,
): Promise<ImportJobEntity> {
  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, organizationId },
  });
  if (!job) throw appError("Import job not found", 404);
  if (job.status !== "VALIDATED") {
    throw appError("Import must be validated before starting", 400);
  }
  if (job.validRows === 0) {
    throw appError("Import has no valid rows to commit", 400);
  }

  const updated = await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "QUEUED" },
  });

  await enqueueImportJob(job.id, organizationId);
  return toImportJobDto(updated);
}

export async function processImportJob(importJobId: string, organizationId: string): Promise<void> {
  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, organizationId },
  });
  if (!job) throw appError("Import job not found", 404);

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING" },
  });

  const rows = await prisma.importJobRow.findMany({
    where: { importJobId: job.id, status: "VALID" },
    orderBy: { rowNumber: "asc" },
  });

  const sortedRows = [...rows].sort((a, b) => {
    const typeA = (a.normalizedData as NormalizedImportRow | null)?.productType;
    const typeB = (b.normalizedData as NormalizedImportRow | null)?.productType;
    const rank = (type?: string) => (type === "VARIANT" ? 1 : 0);
    return rank(typeA) - rank(typeB) || a.rowNumber - b.rowNumber;
  });

  const categories = await prisma.category.findMany({
    where: { organizationId },
    select: { id: true, code: true },
  });
  const categoryByCode = new Map(categories.map((category) => [category.code, category.id]));

  const skuToProductId = new Map<string, string>();
  const existingProducts = await prisma.product.findMany({
    where: { organizationId, deletedAt: null },
    select: { id: true, sku: true },
  });
  for (const product of existingProducts) {
    skuToProductId.set(product.sku, product.id);
  }

  let committedRows = 0;
  let skippedRows = 0;

  try {
    for (const row of sortedRows) {
      const normalized = row.normalizedData as NormalizedImportRow | null;
      if (!normalized) continue;

      let product;
      if (normalized.productType === "VARIANT") {
        const parentId = normalized.parentSku ? skuToProductId.get(normalized.parentSku) : undefined;
        if (!parentId) {
          skippedRows++;
          await prisma.importJobRow.update({
            where: { id: row.id },
            data: { status: "SKIPPED" },
          });
          continue;
        }

        product = await createProduct(organizationId, {
          productType: "VARIANT",
          sku: normalized.sku,
          title: normalized.title ?? normalized.sku,
          description: normalized.description,
          brand: normalized.brand,
          parentId,
          primaryCategoryId: normalized.categoryCode
            ? categoryByCode.get(normalized.categoryCode)
            : undefined,
        });
        skuToProductId.set(normalized.sku, product.id);
      } else {
        product = await createProduct(organizationId, {
          productType: normalized.productType,
          sku: normalized.sku,
          title: normalized.title ?? normalized.sku,
          description: normalized.description,
          brand: normalized.brand,
          primaryCategoryId: normalized.categoryCode
            ? categoryByCode.get(normalized.categoryCode)
            : undefined,
        });
        skuToProductId.set(normalized.sku, product.id);
      }

      if (Object.keys(normalized.attributes).length > 0) {
        await setProductAttributes(product.id, organizationId, {
          attributes: normalized.attributes,
        });
      }

      committedRows++;
      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "COMMITTED", entityId: skuToProductId.get(normalized.sku) },
      });
    }

    await prisma.importRunSummary.update({
      where: { importJobId: job.id },
      data: {
        committedRows,
        skippedRows,
        completedAt: new Date(),
      },
    });

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        committedRows,
      },
    });

    const auditLogId = await writeAudit({
      organizationId,
      entityType: "ImportJob",
      entityId: job.id,
      action: "IMPORT",
      source: "import",
      after: { committedRows, skippedRows, status: "COMPLETED" },
    });

    await emitAuditRecordEvent({
      organizationId,
      auditLogId,
      entityType: "ImportJob",
      entityId: job.id,
      action: "IMPORT",
    });

    await emitEvent(
      createEvent("import.job.completed", organizationId, {
        importJobId: job.id,
        committedRows,
        skippedRows,
        status: "COMPLETED",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import processing failed";
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    await writeAudit({
      organizationId,
      entityType: "ImportJob",
      entityId: job.id,
      action: "IMPORT",
      source: "import",
      after: { status: "FAILED", errorMessage: message },
    });

    throw error;
  }
}

export async function getImportJob(
  importJobId: string,
  organizationId: string,
): Promise<ImportJobEntity & { summary: ImportRunSummaryEntity | null }> {
  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, organizationId },
    include: { summary: true },
  });
  if (!job) throw appError("Import job not found", 404);

  return {
    ...toImportJobDto(job),
    summary: job.summary
      ? {
          id: job.summary.id,
          importJobId: job.summary.importJobId,
          totalRows: job.summary.totalRows,
          validRows: job.summary.validRows,
          invalidRows: job.summary.invalidRows,
          committedRows: job.summary.committedRows,
          skippedRows: job.summary.skippedRows,
          duplicateRows: job.summary.duplicateRows,
          summaryJson: job.summary.summaryJson as Record<string, unknown> | null,
          completedAt: job.summary.completedAt?.toISOString() ?? null,
          createdAt: job.summary.createdAt.toISOString(),
          updatedAt: job.summary.updatedAt.toISOString(),
        }
      : null,
  };
}

export async function listImportJobs(
  organizationId: string,
  query: ListImportsQuery,
): Promise<{ items: ImportJobEntity[]; total: number }> {
  const where = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, jobs] = await Promise.all([
    prisma.importJob.count({ where }),
    prisma.importJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items: jobs.map(toImportJobDto), total };
}

export async function getImportErrors(
  importJobId: string,
  organizationId: string,
): Promise<ImportJobErrorEntity[]> {
  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, organizationId },
  });
  if (!job) throw appError("Import job not found", 404);

  const errors = await prisma.importJobError.findMany({
    where: { importJobId },
    orderBy: [{ rowNumber: "asc" }, { fieldName: "asc" }],
  });

  return errors.map((error) => ({
    id: error.id,
    importJobId: error.importJobId,
    rowNumber: error.rowNumber,
    fieldName: error.fieldName,
    errorCode: error.errorCode,
    errorMessage: error.errorMessage,
    rawValue: error.rawValue,
  }));
}

export async function getImportReport(
  importJobId: string,
  organizationId: string,
): Promise<string> {
  const errors = await getImportErrors(importJobId, organizationId);
  return buildErrorReportCsv(
    errors.map((error) => ({
      rowNumber: error.rowNumber,
      fieldName: error.fieldName,
      errorCode: error.errorCode,
      errorMessage: error.errorMessage,
      rawValue: error.rawValue ?? undefined,
    })),
  );
}

export async function createImportTemplate(
  organizationId: string,
  input: CreateImportTemplateInput,
): Promise<ImportTemplateEntity> {
  const existing = await prisma.importTemplate.findFirst({
    where: { organizationId, code: input.code },
    select: { id: true },
  });
  if (existing) throw appError(`Import template code already exists: ${input.code}`, 409);

  if (input.isDefault) {
    await prisma.importTemplate.updateMany({
      where: { organizationId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.importTemplate.create({
    data: {
      organizationId,
      code: input.code,
      name: input.name,
      entityType: input.entityType ?? "PRODUCT",
      sourceFormat: input.sourceFormat ?? "CSV",
      configJson: input.configJson,
      isDefault: input.isDefault ?? false,
      mappings: {
        create: input.mappings.map((mapping, index) => ({
          sourceColumn: mapping.sourceColumn,
          targetField: mapping.targetField,
          transform: mapping.transform,
          isRequired: mapping.isRequired ?? false,
          sortOrder: mapping.sortOrder ?? index,
        })),
      },
    },
    include: { mappings: { orderBy: { sortOrder: "asc" } } },
  });

  return {
    id: template.id,
    organizationId: template.organizationId,
    code: template.code,
    name: template.name,
    entityType: template.entityType,
    sourceFormat: template.sourceFormat,
    configJson: template.configJson as Record<string, unknown> | null,
    isDefault: template.isDefault,
    mappings: template.mappings.map((mapping) => ({
      id: mapping.id,
      sourceColumn: mapping.sourceColumn,
      targetField: mapping.targetField,
      transform: mapping.transform,
      isRequired: mapping.isRequired,
      sortOrder: mapping.sortOrder,
    })),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function listImportTemplates(
  organizationId: string,
): Promise<ImportTemplateEntity[]> {
  const templates = await prisma.importTemplate.findMany({
    where: { organizationId },
    include: { mappings: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return templates.map((template) => ({
    id: template.id,
    organizationId: template.organizationId,
    code: template.code,
    name: template.name,
    entityType: template.entityType,
    sourceFormat: template.sourceFormat,
    configJson: template.configJson as Record<string, unknown> | null,
    isDefault: template.isDefault,
    mappings: template.mappings.map((mapping) => ({
      id: mapping.id,
      sourceColumn: mapping.sourceColumn,
      targetField: mapping.targetField,
      transform: mapping.transform,
      isRequired: mapping.isRequired,
      sortOrder: mapping.sortOrder,
    })),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }));
}
