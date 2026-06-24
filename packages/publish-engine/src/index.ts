export type PublishableStatus = "APPROVED" | "PUBLISH_READY" | "PUBLISHED";

export type ChannelTransformType = "DIRECT" | "TEMPLATE" | "CONCAT" | "LOOKUP" | "DEFAULT";

export interface ChannelFieldMappingInput {
  sourceField: string;
  targetField: string;
  transformType: ChannelTransformType;
  transformConfig?: Record<string, unknown> | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface ChannelValidationRuleInput {
  code: string;
  ruleType: "REQUIRED_FIELD" | "ALLOWED_STATUS" | "REQUIRED_ATTRIBUTE";
  ruleConfig: Record<string, unknown>;
}

export interface CanonicalProductRecord {
  product_id: string;
  sku: string;
  product_type: string;
  status: string;
  title: string;
  description: string | null;
  brand: string | null;
  parent_sku: string | null;
  category_code: string | null;
  category_path: string | null;
  attributes: Record<string, unknown>;
}

export interface MappingError {
  targetField: string;
  message: string;
}

export interface MappedExportRow {
  product_id: string;
  sku: string;
  fields: Record<string, string>;
  errors: MappingError[];
}

export const PUBLISHABLE_STATUSES: PublishableStatus[] = ["APPROVED", "PUBLISH_READY", "PUBLISHED"];

export function isPublishableStatus(status: string): status is PublishableStatus {
  return PUBLISHABLE_STATUSES.includes(status as PublishableStatus);
}

function getSourceValue(record: CanonicalProductRecord, sourceField: string): unknown {
  if (sourceField.startsWith("attributes.")) {
    const key = sourceField.slice("attributes.".length);
    return record.attributes[key];
  }

  const coreMap: Record<string, unknown> = {
    product_id: record.product_id,
    sku: record.sku,
    product_type: record.product_type,
    status: record.status,
    title: record.title,
    description: record.description,
    brand: record.brand,
    parent_sku: record.parent_sku,
    category_code: record.category_code,
    category_path: record.category_path,
  };

  return coreMap[sourceField];
}

function applyTransform(
  value: unknown,
  mapping: ChannelFieldMappingInput,
  record: CanonicalProductRecord,
): string | null {
  switch (mapping.transformType) {
    case "DIRECT":
      return value == null || value === "" ? null : String(value);

    case "DEFAULT": {
      if (value != null && value !== "") return String(value);
      const defaultValue = mapping.transformConfig?.defaultValue;
      return defaultValue == null ? null : String(defaultValue);
    }

    case "TEMPLATE": {
      const template = String(mapping.transformConfig?.template ?? "");
      return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, token: string) => {
        const resolved = getSourceValue(record, token.includes(".") ? token : token);
        if (token.startsWith("attributes.")) {
          return String(getSourceValue(record, token) ?? "");
        }
        const direct = getSourceValue(record, token);
        return direct == null ? "" : String(direct);
      });
    }

    case "CONCAT": {
      const fields = Array.isArray(mapping.transformConfig?.fields)
        ? (mapping.transformConfig.fields as string[])
        : [];
      const separator = String(mapping.transformConfig?.separator ?? " ");
      const parts = fields
        .map((field) => getSourceValue(record, field))
        .filter((part) => part != null && part !== "")
        .map(String);
      return parts.length > 0 ? parts.join(separator) : null;
    }

    case "LOOKUP": {
      const lookup = mapping.transformConfig?.lookup;
      if (!lookup || typeof lookup !== "object") return value == null ? null : String(value);
      const key = value == null ? "" : String(value);
      const mapped = (lookup as Record<string, string>)[key];
      return mapped ?? (value == null ? null : String(value));
    }

    default:
      return value == null ? null : String(value);
  }
}

export function applyChannelMappings(
  record: CanonicalProductRecord,
  mappings: ChannelFieldMappingInput[],
): MappedExportRow {
  const fields: Record<string, string> = {};
  const errors: MappingError[] = [];

  const sorted = [...mappings].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const mapping of sorted) {
    const sourceValue = getSourceValue(record, mapping.sourceField);
    const transformed = applyTransform(sourceValue, mapping, record);

    if ((transformed == null || transformed === "") && mapping.isRequired) {
      errors.push({
        targetField: mapping.targetField,
        message: `Required field missing for source ${mapping.sourceField}`,
      });
      continue;
    }

    if (transformed != null) {
      fields[mapping.targetField] = transformed;
    }
  }

  return {
    product_id: record.product_id,
    sku: record.sku,
    fields,
    errors,
  };
}

export function validateChannelExport(
  record: CanonicalProductRecord,
  rules: ChannelValidationRuleInput[],
): string[] {
  const errors: string[] = [];

  for (const rule of rules) {
    if (rule.ruleType === "ALLOWED_STATUS") {
      const allowed = Array.isArray(rule.ruleConfig.statuses)
        ? (rule.ruleConfig.statuses as string[])
        : PUBLISHABLE_STATUSES;
      if (!allowed.includes(record.status)) {
        errors.push(`Product status ${record.status} is not allowed for export`);
      }
    }

    if (rule.ruleType === "REQUIRED_FIELD") {
      const fields = Array.isArray(rule.ruleConfig.fields)
        ? (rule.ruleConfig.fields as string[])
        : [];
      for (const field of fields) {
        const value = getSourceValue(record, field);
        if (value == null || value === "") {
          errors.push(`Required field missing: ${field}`);
        }
      }
    }

    if (rule.ruleType === "REQUIRED_ATTRIBUTE") {
      const keys = Array.isArray(rule.ruleConfig.attributeKeys)
        ? (rule.ruleConfig.attributeKeys as string[])
        : [];
      for (const key of keys) {
        const value = record.attributes[key];
        if (value == null || value === "") {
          errors.push(`Required attribute missing: ${key}`);
        }
      }
    }
  }

  return errors;
}

export function buildExportRows(
  records: CanonicalProductRecord[],
  mappings: ChannelFieldMappingInput[],
  rules: ChannelValidationRuleInput[] = [],
): MappedExportRow[] {
  return records.map((record) => {
    const validationErrors = validateChannelExport(record, rules);
    const mapped = applyChannelMappings(record, mappings);
    if (validationErrors.length > 0) {
      mapped.errors.push(
        ...validationErrors.map((message) => ({
          targetField: "_validation",
          message,
        })),
      );
    }
    return mapped;
  });
}

export function serializeExportCsv(
  rows: MappedExportRow[],
  targetFields: string[],
): string {
  const header = targetFields.join(",");
  const lines = rows.map((row) =>
    targetFields
      .map((field) => {
        const value = row.fields[field] ?? "";
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export function serializeExportJson(rows: MappedExportRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      product_id: row.product_id,
      sku: row.sku,
      ...row.fields,
      _errors: row.errors,
    })),
    null,
    2,
  );
}
