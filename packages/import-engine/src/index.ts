import { parseImportSellingPoints, PRODUCT_IMPORT_CORE_FIELD_KEYS } from "./product-import-fields.js";

export type ProductType = "SIMPLE" | "PARENT" | "VARIANT";
export type DuplicatePolicy = "REJECT" | "UPDATE" | "SKIP";
export type BlankCellPolicy = "IGNORE" | "CLEAR";

export {
  buildDefaultTemplateMappings,
  buildImportExampleCsv,
  buildImportExampleFile,
  buildImportExampleJson,
  buildImportExampleXml,
  IMPORT_EXAMPLE_FILE_TYPES,
  importExampleProducts,
  mergeTemplateMappings,
  parseImportDate,
  parseImportSellingPoints,
  PRODUCT_IMPORT_ATTRIBUTE_FIELD_KEYS,
  PRODUCT_IMPORT_ATTRIBUTE_FIELDS,
  PRODUCT_IMPORT_CORE_FIELD_KEYS,
  PRODUCT_IMPORT_CORE_FIELDS,
  PRODUCT_IMPORT_SAMPLE_FIELD_KEYS,
  type ImportExampleProduct,
  type ProductImportCoreFieldKey,
} from "./product-import-fields.js";

export {
  buildDefaultAttributeTemplateMappings,
  buildDefaultCategoryTemplateMappings,
  buildDefaultFacetTemplateMappings,
  buildDefaultTemplateMappingsForEntity,
  buildAttributeImportExampleCsv,
  buildCategoryImportExampleCsv,
  buildFacetImportExampleCsv,
  buildTaxonomyImportExample,
  mergeTaxonomyTemplateMappings,
  normalizeAttributeRow,
  normalizeCategoryRow,
  normalizeFacetRow,
  sortCategoryRowsForCommit,
  TAXONOMY_IMPORT_RECORD_CONFIG,
  validateAttributeImportRows,
  validateCategoryImportRows,
  validateFacetImportRows,
  type AttributeValidationContext,
  type CategoryValidationContext,
  type FacetValidationContext,
  type NormalizedAttributeImportRow,
  type NormalizedCategoryImportRow,
  type NormalizedFacetImportRow,
  type TaxonomyImportEntityType,
  type TaxonomyImportTemplateMapping,
  type TaxonomyRowValidationError,
} from "./taxonomy-import-fields.js";

export {
  collectImportRows,
  fieldsToStringRecord,
  flattenObject,
  inferImportFileType,
  ImportParseError,
  parseJson,
  parseXml,
  type ImportFileType,
  type ImportRow,
  type JsonParseOptions,
  type XmlParseOptions,
} from "./parser.js";

export interface TemplateMapping {
  sourceColumn: string;
  targetField: string;
  isRequired?: boolean;
}

export interface ParsedCsv {
  headers: string[];
  rows: Array<{ rowNumber: number; data: Record<string, string> }>;
}

export interface NormalizedImportRow {
  rowNumber: number;
  sku: string;
  productType: ProductType;
  title?: string;
  description?: string;
  brand?: string;
  parentSku?: string;
  categoryCode?: string;
  summary?: string;
  sellingPoints?: string[];
  startDate?: string;
  discontinueDate?: string;
  attributes: Record<string, string>;
  raw: Record<string, string>;
}

export interface RowValidationError {
  rowNumber: number;
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  rawValue?: string;
}

export interface ValidationContext {
  duplicatePolicy: DuplicatePolicy;
  importType: "CREATE" | "UPDATE" | "UPSERT";
  existingSkus: Set<string>;
  parentSkusInDb: Set<string>;
  categoryCodes: Set<string>;
  attributeKeys: Set<string>;
  requiredFieldsByType: Partial<Record<ProductType, string[]>>;
}

export interface ValidationResult {
  validRows: NormalizedImportRow[];
  errors: RowValidationError[];
}

export function parseCsv(content: string): ParsedCsv {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]!).map((header) => header.trim());
  const rows: ParsedCsv["rows"] = [];

  for (let index = 1; index < lines.length; index++) {
    const values = parseCsvLine(lines[index]!);
    const data: Record<string, string> = {};
    for (let column = 0; column < headers.length; column++) {
      data[headers[column]!] = values[column] ?? "";
    }
    rows.push({ rowNumber: index + 1, data });
  }

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function normalizeRow(
  rowNumber: number,
  raw: Record<string, string>,
  mappings: TemplateMapping[],
  blankCellPolicy: BlankCellPolicy,
): NormalizedImportRow | null {
  const mapped: Record<string, string> = {};

  for (const mapping of mappings) {
    const rawValue = raw[mapping.sourceColumn] ?? "";
    if (rawValue === "" && blankCellPolicy === "IGNORE") {
      continue;
    }
    mapped[mapping.targetField] = rawValue;
  }

  for (const key of PRODUCT_IMPORT_CORE_FIELD_KEYS) {
    if (mapped[key]?.trim()) continue;
    const rawValue = raw[key]?.trim();
    if (rawValue) {
      mapped[key] = rawValue;
    }
  }

  const sku = mapped.sku?.trim();
  const productTypeRaw = mapped.product_type?.trim().toUpperCase();
  if (!sku || !productTypeRaw) {
    return null;
  }

  if (!["SIMPLE", "PARENT", "VARIANT"].includes(productTypeRaw)) {
    return null;
  }

  const coreFieldKeys = new Set<string>(PRODUCT_IMPORT_CORE_FIELD_KEYS);

  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(mapped)) {
    if (!coreFieldKeys.has(key) && value !== "") {
      attributes[key] = value;
    }
  }

  const sellingPointsRaw = mapped.selling_points?.trim();
  const sellingPoints = sellingPointsRaw ? parseImportSellingPoints(sellingPointsRaw) : undefined;

  return {
    rowNumber,
    sku,
    productType: productTypeRaw as ProductType,
    title: mapped.title?.trim() || undefined,
    description: mapped.description?.trim() || undefined,
    brand: mapped.brand?.trim() || undefined,
    parentSku: mapped.parent_sku?.trim() || undefined,
    categoryCode: mapped.category_code?.trim() || undefined,
    summary: mapped.summary?.trim() || undefined,
    sellingPoints,
    startDate: mapped.start_date?.trim() || undefined,
    discontinueDate: mapped.discontinue_date?.trim() || undefined,
    attributes,
    raw,
  };
}

export function applyFacetValuesToAttributes(
  row: NormalizedImportRow,
  facetSourceByKey: Map<string, string>,
): NormalizedImportRow {
  if (facetSourceByKey.size === 0) return row;

  const attributes = { ...row.attributes };

  for (const [key, value] of Object.entries(attributes)) {
    if (!value || !key.startsWith("facet_")) continue;
    const facetKey = key.slice("facet_".length);
    const sourceKey = facetSourceByKey.get(facetKey);
    if (!sourceKey) continue;
    if (!attributes[sourceKey]) {
      attributes[sourceKey] = value;
    }
    delete attributes[key];
  }

  const rawFacets = row.raw.facets;
  if (rawFacets && typeof rawFacets === "object" && !Array.isArray(rawFacets)) {
    for (const [facetKey, facetValue] of Object.entries(rawFacets as Record<string, unknown>)) {
      if (facetValue == null) continue;
      const sourceKey = facetSourceByKey.get(facetKey);
      const normalizedValue = String(facetValue).trim();
      if (sourceKey && normalizedValue && !attributes[sourceKey]) {
        attributes[sourceKey] = normalizedValue;
      }
    }
  }

  for (const [key, value] of Object.entries(row.raw)) {
    if (!value || !key.startsWith("facet_")) continue;
    const facetKey = key.slice("facet_".length);
    const sourceKey = facetSourceByKey.get(facetKey);
    const normalizedValue = value.trim();
    if (sourceKey && normalizedValue && !attributes[sourceKey]) {
      attributes[sourceKey] = normalizedValue;
    }
  }

  return {
    ...row,
    attributes,
  };
}

export function validateImportRows(
  rows: NormalizedImportRow[],
  context: ValidationContext,
): ValidationResult {
  const errors: RowValidationError[] = [];
  const validRows: NormalizedImportRow[] = [];
  const skusInFile = new Map<string, number>();
  const parentSkusInFile = new Set(
    rows.filter((row) => row.productType === "PARENT").map((row) => row.sku),
  );

  for (const row of rows) {
    const rowErrors = validateRow(row, context, skusInFile, parentSkusInFile);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validRows.push(row);
      skusInFile.set(row.sku, row.rowNumber);
    }
  }

  return { validRows, errors };
}

function validateRow(
  row: NormalizedImportRow,
  context: ValidationContext,
  skusInFile: Map<string, number>,
  parentSkusInFile: Set<string>,
): RowValidationError[] {
  const errors: RowValidationError[] = [];

  const requiredFields = context.requiredFieldsByType[row.productType] ?? ["sku", "product_type"];
  for (const field of requiredFields) {
    const value = getFieldValue(row, field);
    if (!value) {
      errors.push({
        rowNumber: row.rowNumber,
        fieldName: field,
        errorCode: "REQUIRED_FIELD",
        errorMessage: `Required field missing: ${field}`,
        rawValue: value,
      });
    }
  }

  if (row.productType === "VARIANT" && !row.parentSku) {
    errors.push({
      rowNumber: row.rowNumber,
      fieldName: "parent_sku",
      errorCode: "REQUIRED_FIELD",
      errorMessage: "Variant rows must include parent_sku",
      rawValue: row.raw.parent_sku,
    });
  }

  const duplicateRow = skusInFile.get(row.sku);
  if (duplicateRow) {
    errors.push({
      rowNumber: row.rowNumber,
      fieldName: "sku",
      errorCode: "DUPLICATE_KEY",
      errorMessage: `Duplicate SKU in file (first seen on row ${duplicateRow})`,
      rawValue: row.sku,
    });
  }

  if (context.existingSkus.has(row.sku)) {
    if (context.duplicatePolicy === "REJECT" || context.importType === "CREATE") {
      errors.push({
        rowNumber: row.rowNumber,
        fieldName: "sku",
        errorCode: "DUPLICATE_KEY",
        errorMessage: `SKU already exists: ${row.sku}`,
        rawValue: row.sku,
      });
    }
  }

  if (row.productType === "VARIANT" && row.parentSku) {
    const parentInFile = parentSkusInFile.has(row.parentSku);
    const parentInDb = context.parentSkusInDb.has(row.parentSku);
    if (!parentInFile && !parentInDb) {
      errors.push({
        rowNumber: row.rowNumber,
        fieldName: "parent_sku",
        errorCode: "INVALID_PARENT_REFERENCE",
        errorMessage: `Parent SKU not found: ${row.parentSku}`,
        rawValue: row.parentSku,
      });
    }
  }

  if (row.categoryCode && !context.categoryCodes.has(row.categoryCode)) {
    errors.push({
      rowNumber: row.rowNumber,
      fieldName: "category_code",
      errorCode: "INVALID_CATEGORY",
      errorMessage: `Unknown category code: ${row.categoryCode}`,
      rawValue: row.categoryCode,
    });
  }

  for (const [attributeKey, attributeValue] of Object.entries(row.attributes)) {
    if (attributeValue === "") continue;
    if (!context.attributeKeys.has(attributeKey)) {
      errors.push({
        rowNumber: row.rowNumber,
        fieldName: attributeKey,
        errorCode: "UNKNOWN_ATTRIBUTE",
        errorMessage: `Unknown attribute key: ${attributeKey}`,
        rawValue: attributeValue,
      });
    }
  }

  return errors;
}

function getFieldValue(row: NormalizedImportRow, field: string): string | undefined {
  switch (field) {
    case "sku":
      return row.sku;
    case "product_type":
      return row.productType;
    case "title":
      return row.title;
    case "description":
      return row.description;
    case "brand":
      return row.brand;
    case "parent_sku":
      return row.parentSku;
    case "category_code":
      return row.categoryCode;
    case "summary":
      return row.summary;
    case "selling_points":
      return row.sellingPoints?.join("|");
    case "start_date":
      return row.startDate;
    case "discontinue_date":
      return row.discontinueDate;
    default:
      return row.attributes[field] ?? row.raw[field];
  }
}

export function buildErrorReportCsv(errors: RowValidationError[]): string {
  const header = "row_number,field_name,error_code,error_message,raw_value";
  const lines = errors.map((error) =>
    [
      error.rowNumber,
      csvEscape(error.fieldName),
      csvEscape(error.errorCode),
      csvEscape(error.errorMessage),
      csvEscape(error.rawValue ?? ""),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
