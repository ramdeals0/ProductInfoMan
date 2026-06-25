import type { ImportExampleFileType } from "./product-import-fields.js";

export type TaxonomyImportEntityType = "CATEGORY" | "ATTRIBUTE" | "FACET";

export interface TaxonomyImportTemplateMapping {
  sourceColumn: string;
  targetField: string;
  isRequired?: boolean;
}

export interface NormalizedCategoryImportRow {
  rowNumber: number;
  code: string;
  name: string;
  slug: string;
  parentCode?: string;
  sortOrder: number;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  raw: Record<string, string>;
}

export interface NormalizedAttributeImportRow {
  rowNumber: number;
  attributeGroupCode: string;
  key: string;
  label: string;
  description?: string;
  dataType: "TEXT" | "RICH_TEXT" | "NUMBER" | "BOOLEAN" | "ENUM" | "DATE" | "URL" | "JSON";
  isGlobal: boolean;
  isVariantAxis: boolean;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  allowedValuesType: "FREE_TEXT" | "CONTROLLED_LIST" | "NUMERIC_RANGE";
  raw: Record<string, string>;
}

export interface NormalizedFacetImportRow {
  rowNumber: number;
  key: string;
  label: string;
  sourceAttributeKey: string;
  categoryCode?: string;
  sortOrder: number;
  isDynamic: boolean;
  isActive: boolean;
  raw: Record<string, string>;
}

export interface TaxonomyRowValidationError {
  rowNumber: number;
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  rawValue?: string;
}

const CATEGORY_FIELDS = [
  { key: "code", required: true },
  { key: "name", required: true },
  { key: "slug", required: true },
  { key: "parent_code", required: false },
  { key: "sort_order", required: false },
  { key: "status", required: false },
] as const;

const ATTRIBUTE_FIELDS = [
  { key: "attribute_group_code", required: true },
  { key: "key", required: true },
  { key: "label", required: true },
  { key: "description", required: false },
  { key: "data_type", required: false },
  { key: "is_global", required: false },
  { key: "is_variant_axis", required: false },
  { key: "is_required", required: false },
  { key: "is_filterable", required: false },
  { key: "is_searchable", required: false },
  { key: "allowed_values_type", required: false },
] as const;

const FACET_FIELDS = [
  { key: "key", required: true },
  { key: "label", required: true },
  { key: "source_attribute_key", required: true },
  { key: "category_code", required: false },
  { key: "sort_order", required: false },
  { key: "is_dynamic", required: false },
  { key: "is_active", required: false },
] as const;

const ATTRIBUTE_DATA_TYPES = new Set([
  "TEXT",
  "RICH_TEXT",
  "NUMBER",
  "BOOLEAN",
  "ENUM",
  "DATE",
  "URL",
  "JSON",
]);

const ALLOWED_VALUES_TYPES = new Set(["FREE_TEXT", "CONTROLLED_LIST", "NUMERIC_RANGE"]);
const CATEGORY_STATUSES = new Set(["ACTIVE", "INACTIVE", "ARCHIVED"]);

const CATEGORY_EXAMPLES = [
  {
    code: "apparel",
    name: "Apparel",
    slug: "apparel",
    parent_code: "",
    sort_order: "0",
    status: "ACTIVE",
  },
  {
    code: "shirts",
    name: "Shirts",
    slug: "shirts",
    parent_code: "apparel",
    sort_order: "1",
    status: "ACTIVE",
  },
  {
    code: "oxford",
    name: "Oxford Shirts",
    slug: "oxford",
    parent_code: "shirts",
    sort_order: "2",
    status: "ACTIVE",
  },
];

const ATTRIBUTE_EXAMPLES = [
  {
    attribute_group_code: "specs",
    key: "color",
    label: "Color",
    description: "Product color",
    data_type: "TEXT",
    is_global: "false",
    is_variant_axis: "true",
    is_required: "false",
    is_filterable: "true",
    is_searchable: "false",
    allowed_values_type: "FREE_TEXT",
  },
  {
    attribute_group_code: "specs",
    key: "fabric",
    label: "Fabric",
    description: "Primary fabric",
    data_type: "TEXT",
    is_global: "false",
    is_variant_axis: "false",
    is_required: "false",
    is_filterable: "true",
    is_searchable: "false",
    allowed_values_type: "FREE_TEXT",
  },
  {
    attribute_group_code: "pricing",
    key: "price",
    label: "Price",
    description: "Retail price",
    data_type: "NUMBER",
    is_global: "true",
    is_variant_axis: "false",
    is_required: "false",
    is_filterable: "true",
    is_searchable: "false",
    allowed_values_type: "NUMERIC_RANGE",
  },
];

const FACET_EXAMPLES = [
  {
    key: "color",
    label: "Color",
    source_attribute_key: "color",
    category_code: "",
    sort_order: "0",
    is_dynamic: "false",
    is_active: "true",
  },
  {
    key: "fabric",
    label: "Fabric",
    source_attribute_key: "fabric",
    category_code: "oxford",
    sort_order: "1",
    is_dynamic: "false",
    is_active: "true",
  },
  {
    key: "price",
    label: "Price",
    source_attribute_key: "price",
    category_code: "",
    sort_order: "2",
    is_dynamic: "true",
    is_active: "true",
  },
];

export const TAXONOMY_IMPORT_RECORD_CONFIG: Record<
  TaxonomyImportEntityType,
  { jsonRootKeys: string[]; xmlRoot: string; xmlRecordElement: string }
> = {
  CATEGORY: { jsonRootKeys: ["categories", "category"], xmlRoot: "categories", xmlRecordElement: "category" },
  ATTRIBUTE: { jsonRootKeys: ["attributes", "attribute"], xmlRoot: "attributes", xmlRecordElement: "attribute" },
  FACET: { jsonRootKeys: ["facets", "facet"], xmlRoot: "facets", xmlRecordElement: "facet" },
};

function fieldMappings(
  fields: ReadonlyArray<{ key: string; required: boolean }>,
): TaxonomyImportTemplateMapping[] {
  return fields.map((field) => ({
    sourceColumn: field.key,
    targetField: field.key,
    isRequired: field.required,
  }));
}

export function buildDefaultCategoryTemplateMappings(): TaxonomyImportTemplateMapping[] {
  return fieldMappings(CATEGORY_FIELDS);
}

export function buildDefaultAttributeTemplateMappings(): TaxonomyImportTemplateMapping[] {
  return fieldMappings(ATTRIBUTE_FIELDS);
}

export function buildDefaultFacetTemplateMappings(): TaxonomyImportTemplateMapping[] {
  return fieldMappings(FACET_FIELDS);
}

export function buildDefaultTemplateMappingsForEntity(
  entityType: TaxonomyImportEntityType | "PRODUCT" | "VARIANT",
): TaxonomyImportTemplateMapping[] {
  switch (entityType) {
    case "CATEGORY":
      return buildDefaultCategoryTemplateMappings();
    case "ATTRIBUTE":
      return buildDefaultAttributeTemplateMappings();
    case "FACET":
      return buildDefaultFacetTemplateMappings();
    default:
      throw new Error(`Unsupported taxonomy entity type: ${entityType}`);
  }
}

export function mergeTaxonomyTemplateMappings(
  mappings: TaxonomyImportTemplateMapping[],
  defaults: TaxonomyImportTemplateMapping[],
): TaxonomyImportTemplateMapping[] {
  const merged = new Map<string, TaxonomyImportTemplateMapping>();
  for (const mapping of defaults) {
    merged.set(mapping.sourceColumn, mapping);
  }
  for (const mapping of mappings) {
    merged.set(mapping.sourceColumn, mapping);
  }
  return [...merged.values()];
}

function applyMappings(
  raw: Record<string, string>,
  mappings: TaxonomyImportTemplateMapping[],
  blankCellPolicy: "IGNORE" | "CLEAR",
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const mapping of mappings) {
    const rawValue = raw[mapping.sourceColumn] ?? "";
    if (rawValue === "" && blankCellPolicy === "IGNORE") continue;
    mapped[mapping.targetField] = rawValue;
  }
  return mapped;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value?.trim()) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function parseInteger(value: string | undefined, defaultValue: number): number {
  if (!value?.trim()) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function normalizeCategoryRow(
  rowNumber: number,
  raw: Record<string, string>,
  mappings: TaxonomyImportTemplateMapping[],
  blankCellPolicy: "IGNORE" | "CLEAR",
): NormalizedCategoryImportRow | null {
  const mapped = applyMappings(raw, mappings, blankCellPolicy);
  const code = mapped.code?.trim();
  const name = mapped.name?.trim();
  const slug = mapped.slug?.trim();
  if (!code || !name || !slug) return null;

  const statusRaw = mapped.status?.trim().toUpperCase() || "ACTIVE";
  const status = CATEGORY_STATUSES.has(statusRaw)
    ? (statusRaw as NormalizedCategoryImportRow["status"])
    : "ACTIVE";

  return {
    rowNumber,
    code,
    name,
    slug,
    parentCode: mapped.parent_code?.trim() || undefined,
    sortOrder: parseInteger(mapped.sort_order, 0),
    status,
    raw,
  };
}

export function normalizeAttributeRow(
  rowNumber: number,
  raw: Record<string, string>,
  mappings: TaxonomyImportTemplateMapping[],
  blankCellPolicy: "IGNORE" | "CLEAR",
): NormalizedAttributeImportRow | null {
  const mapped = applyMappings(raw, mappings, blankCellPolicy);
  const attributeGroupCode = mapped.attribute_group_code?.trim();
  const key = mapped.key?.trim();
  const label = mapped.label?.trim();
  if (!attributeGroupCode || !key || !label) return null;

  const dataTypeRaw = mapped.data_type?.trim().toUpperCase() || "TEXT";
  const dataType = ATTRIBUTE_DATA_TYPES.has(dataTypeRaw)
    ? (dataTypeRaw as NormalizedAttributeImportRow["dataType"])
    : "TEXT";

  const allowedValuesRaw = mapped.allowed_values_type?.trim().toUpperCase() || "FREE_TEXT";
  const allowedValuesType = ALLOWED_VALUES_TYPES.has(allowedValuesRaw)
    ? (allowedValuesRaw as NormalizedAttributeImportRow["allowedValuesType"])
    : "FREE_TEXT";

  return {
    rowNumber,
    attributeGroupCode,
    key,
    label,
    description: mapped.description?.trim() || undefined,
    dataType,
    isGlobal: parseBoolean(mapped.is_global, false),
    isVariantAxis: parseBoolean(mapped.is_variant_axis, false),
    isRequired: parseBoolean(mapped.is_required, false),
    isFilterable: parseBoolean(mapped.is_filterable, false),
    isSearchable: parseBoolean(mapped.is_searchable, false),
    allowedValuesType,
    raw,
  };
}

export function normalizeFacetRow(
  rowNumber: number,
  raw: Record<string, string>,
  mappings: TaxonomyImportTemplateMapping[],
  blankCellPolicy: "IGNORE" | "CLEAR",
): NormalizedFacetImportRow | null {
  const mapped = applyMappings(raw, mappings, blankCellPolicy);
  const key = mapped.key?.trim();
  const label = mapped.label?.trim();
  const sourceAttributeKey = mapped.source_attribute_key?.trim();
  if (!key || !label || !sourceAttributeKey) return null;

  return {
    rowNumber,
    key,
    label,
    sourceAttributeKey,
    categoryCode: mapped.category_code?.trim() || undefined,
    sortOrder: parseInteger(mapped.sort_order, 0),
    isDynamic: parseBoolean(mapped.is_dynamic, false),
    isActive: parseBoolean(mapped.is_active, true),
    raw,
  };
}

export interface CategoryValidationContext {
  duplicatePolicy: "REJECT" | "UPDATE" | "SKIP";
  importType: "CREATE" | "UPDATE" | "UPSERT";
  existingCodes: Set<string>;
}

export interface AttributeValidationContext {
  duplicatePolicy: "REJECT" | "UPDATE" | "SKIP";
  importType: "CREATE" | "UPDATE" | "UPSERT";
  existingKeys: Set<string>;
  attributeGroupCodes: Set<string>;
  attributeGroupCodesInFile: Set<string>;
}

export interface FacetValidationContext {
  duplicatePolicy: "REJECT" | "UPDATE" | "SKIP";
  importType: "CREATE" | "UPDATE" | "UPSERT";
  existingKeys: Set<string>;
  attributeKeys: Set<string>;
  categoryCodes: Set<string>;
}

export function validateCategoryImportRows(
  rows: NormalizedCategoryImportRow[],
  context: CategoryValidationContext,
): { validRows: NormalizedCategoryImportRow[]; errors: TaxonomyRowValidationError[] } {
  const errors: TaxonomyRowValidationError[] = [];
  const validRows: NormalizedCategoryImportRow[] = [];
  const codesInFile = new Map<string, number>();
  const allCodesInFile = new Set(rows.map((row) => row.code));

  for (const row of rows) {
    const rowErrors: TaxonomyRowValidationError[] = [];
    const duplicateRow = codesInFile.get(row.code);
    if (duplicateRow) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        fieldName: "code",
        errorCode: "DUPLICATE_KEY",
        errorMessage: `Duplicate category code in file (first seen on row ${duplicateRow})`,
        rawValue: row.code,
      });
    }

    if (context.existingCodes.has(row.code)) {
      if (context.duplicatePolicy === "REJECT" || context.importType === "CREATE") {
        rowErrors.push({
          rowNumber: row.rowNumber,
          fieldName: "code",
          errorCode: "DUPLICATE_KEY",
          errorMessage: `Category code already exists: ${row.code}`,
          rawValue: row.code,
        });
      }
    }

    if (row.parentCode) {
      const parentInFile = allCodesInFile.has(row.parentCode);
      const parentInDb = context.existingCodes.has(row.parentCode);
      if (!parentInFile && !parentInDb) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          fieldName: "parent_code",
          errorCode: "INVALID_PARENT_REFERENCE",
          errorMessage: `Parent category code not found: ${row.parentCode}`,
          rawValue: row.parentCode,
        });
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validRows.push(row);
      codesInFile.set(row.code, row.rowNumber);
    }
  }

  return { validRows, errors };
}

export function validateAttributeImportRows(
  rows: NormalizedAttributeImportRow[],
  context: AttributeValidationContext,
): { validRows: NormalizedAttributeImportRow[]; errors: TaxonomyRowValidationError[] } {
  const errors: TaxonomyRowValidationError[] = [];
  const validRows: NormalizedAttributeImportRow[] = [];
  const keysInFile = new Map<string, number>();

  for (const row of rows) {
    const rowErrors: TaxonomyRowValidationError[] = [];
    const duplicateRow = keysInFile.get(row.key);
    if (duplicateRow) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        fieldName: "key",
        errorCode: "DUPLICATE_KEY",
        errorMessage: `Duplicate attribute key in file (first seen on row ${duplicateRow})`,
        rawValue: row.key,
      });
    }

    if (context.existingKeys.has(row.key)) {
      if (context.duplicatePolicy === "REJECT" || context.importType === "CREATE") {
        rowErrors.push({
          rowNumber: row.rowNumber,
          fieldName: "key",
          errorCode: "DUPLICATE_KEY",
          errorMessage: `Attribute key already exists: ${row.key}`,
          rawValue: row.key,
        });
      }
    }

    const groupExists =
      context.attributeGroupCodes.has(row.attributeGroupCode) ||
      context.attributeGroupCodesInFile.has(row.attributeGroupCode);
    if (!groupExists) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        fieldName: "attribute_group_code",
        errorCode: "INVALID_REFERENCE",
        errorMessage: `Attribute group code not found: ${row.attributeGroupCode}`,
        rawValue: row.attributeGroupCode,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validRows.push(row);
      keysInFile.set(row.key, row.rowNumber);
    }
  }

  return { validRows, errors };
}

export function validateFacetImportRows(
  rows: NormalizedFacetImportRow[],
  context: FacetValidationContext,
): { validRows: NormalizedFacetImportRow[]; errors: TaxonomyRowValidationError[] } {
  const errors: TaxonomyRowValidationError[] = [];
  const validRows: NormalizedFacetImportRow[] = [];
  const keysInFile = new Map<string, number>();

  for (const row of rows) {
    const rowErrors: TaxonomyRowValidationError[] = [];
    const duplicateRow = keysInFile.get(row.key);
    if (duplicateRow) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        fieldName: "key",
        errorCode: "DUPLICATE_KEY",
        errorMessage: `Duplicate facet key in file (first seen on row ${duplicateRow})`,
        rawValue: row.key,
      });
    }

    if (context.existingKeys.has(row.key)) {
      if (context.duplicatePolicy === "REJECT" || context.importType === "CREATE") {
        rowErrors.push({
          rowNumber: row.rowNumber,
          fieldName: "key",
          errorCode: "DUPLICATE_KEY",
          errorMessage: `Facet key already exists: ${row.key}`,
          rawValue: row.key,
        });
      }
    }

    if (!context.attributeKeys.has(row.sourceAttributeKey)) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        fieldName: "source_attribute_key",
        errorCode: "INVALID_REFERENCE",
        errorMessage: `Source attribute key not found: ${row.sourceAttributeKey}`,
        rawValue: row.sourceAttributeKey,
      });
    }

    if (row.categoryCode && !context.categoryCodes.has(row.categoryCode)) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        fieldName: "category_code",
        errorCode: "INVALID_CATEGORY",
        errorMessage: `Unknown category code: ${row.categoryCode}`,
        rawValue: row.categoryCode,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validRows.push(row);
      keysInFile.set(row.key, row.rowNumber);
    }
  }

  return { validRows, errors };
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsvFromRows(headers: string[], rows: Array<Record<string, string>>): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function buildCategoryImportExampleCsv(entityType: TaxonomyImportEntityType = "CATEGORY"): string {
  void entityType;
  return buildCsvFromRows(
    CATEGORY_FIELDS.map((field) => field.key),
    CATEGORY_EXAMPLES,
  );
}

export function buildAttributeImportExampleCsv(): string {
  return buildCsvFromRows(
    ATTRIBUTE_FIELDS.map((field) => field.key),
    ATTRIBUTE_EXAMPLES,
  );
}

export function buildFacetImportExampleCsv(): string {
  return buildCsvFromRows(
    FACET_FIELDS.map((field) => field.key),
    FACET_EXAMPLES,
  );
}

function buildJsonExample(rows: Array<Record<string, string>>): string {
  return `${JSON.stringify(rows, null, 2)}\n`;
}

function buildXmlExample(
  entityType: TaxonomyImportEntityType,
  rows: Array<Record<string, string>>,
): string {
  const config = TAXONOMY_IMPORT_RECORD_CONFIG[entityType];
  const lines = rows.map((row) => {
    const inner = Object.entries(row)
      .filter(([, value]) => value !== "")
      .map(([key, value]) => `    <${key}>${value}</${key}>`)
      .join("\n");
    return `  <${config.xmlRecordElement}>\n${inner}\n  </${config.xmlRecordElement}>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${config.xmlRoot}>\n${lines.join("\n")}\n</${config.xmlRoot}>\n`;
}

export function buildTaxonomyImportExample(
  entityType: TaxonomyImportEntityType,
  fileType: ImportExampleFileType,
): { fileName: string; mimeType: string; content: string } {
  const rows =
    entityType === "CATEGORY"
      ? CATEGORY_EXAMPLES
      : entityType === "ATTRIBUTE"
        ? ATTRIBUTE_EXAMPLES
        : FACET_EXAMPLES;

  const mimeTypes: Record<ImportExampleFileType, string> = {
    CSV: "text/csv",
    JSON: "application/json",
    XML: "application/xml",
  };

  const fileNames: Record<TaxonomyImportEntityType, Record<ImportExampleFileType, string>> = {
    CATEGORY: { CSV: "categories-example.csv", JSON: "categories-example.json", XML: "categories-example.xml" },
    ATTRIBUTE: { CSV: "attributes-example.csv", JSON: "attributes-example.json", XML: "attributes-example.xml" },
    FACET: { CSV: "facets-example.csv", JSON: "facets-example.json", XML: "facets-example.xml" },
  };

  const content =
    fileType === "CSV"
      ? entityType === "CATEGORY"
        ? buildCategoryImportExampleCsv()
        : entityType === "ATTRIBUTE"
          ? buildAttributeImportExampleCsv()
          : buildFacetImportExampleCsv()
      : fileType === "JSON"
        ? buildJsonExample(rows)
        : buildXmlExample(entityType, rows);

  return {
    fileName: fileNames[entityType][fileType],
    mimeType: mimeTypes[fileType],
    content,
  };
}

export function sortCategoryRowsForCommit(
  rows: NormalizedCategoryImportRow[],
): NormalizedCategoryImportRow[] {
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const depthCache = new Map<string, number>();

  const depth = (row: NormalizedCategoryImportRow): number => {
    const cached = depthCache.get(row.code);
    if (cached !== undefined) return cached;
    if (!row.parentCode || !byCode.has(row.parentCode)) {
      depthCache.set(row.code, 0);
      return 0;
    }
    const parent = byCode.get(row.parentCode)!;
    const value = depth(parent) + 1;
    depthCache.set(row.code, value);
    return value;
  };

  return [...rows].sort((a, b) => depth(a) - depth(b) || a.rowNumber - b.rowNumber);
}
