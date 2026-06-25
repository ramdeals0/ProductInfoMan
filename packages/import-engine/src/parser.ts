import { XMLParser } from "fast-xml-parser";

export type ImportFileType = "CSV" | "XML" | "JSON";

export type ImportRow = {
  rawRowIndex: number;
  rawData: unknown;
  fields: Record<string, unknown>;
};

export type JsonParseOptions = {
  rootArrayKey?: string;
  rootArrayKeys?: string[];
};

export type XmlParseOptions = {
  rootElement?: string;
  productElement?: string;
};

export class ImportParseError extends Error {
  constructor(
    message: string,
    public readonly fileType: ImportFileType,
  ) {
    super(message);
    this.name = "ImportParseError";
  }
}

export function inferImportFileType(
  fileName: string,
  explicit?: string | null,
): ImportFileType {
  if (explicit) {
    const normalized = explicit.trim().toLowerCase();
    if (normalized === "csv") return "CSV";
    if (normalized === "xml") return "XML";
    if (normalized === "json") return "JSON";
    throw new ImportParseError(`Unsupported file_type: ${explicit}`, "CSV");
  }

  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "xml") return "XML";
  if (extension === "json") return "JSON";
  return "CSV";
}

export function flattenObject(
  value: unknown,
  prefix = "",
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  if (value === null || value === undefined) {
    if (prefix) result[prefix] = value;
    return result;
  }

  if (Array.isArray(value)) {
    result[prefix || "value"] = value.map((item) =>
      item === null || item === undefined ? "" : String(item),
    ).join(",");
    return result;
  }

  if (typeof value !== "object") {
    if (prefix) result[prefix] = value;
    return result;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      flattenObject(child, path, result);
    } else {
      result[path] = child;
    }
  }

  return result;
}

export function fieldsToStringRecord(fields: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      result[key] = JSON.stringify(value);
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

function normalizeProductArray(value: unknown, label: string): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  throw new ImportParseError(`${label} must contain one or more product records`, "JSON");
}

function extractJsonProducts(parsed: unknown, options: JsonParseOptions = {}): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ImportParseError("JSON root must be an array of product objects", "JSON");
  }

  const record = parsed as Record<string, unknown>;
  const candidateKeys = [
    options.rootArrayKey,
    ...(options.rootArrayKeys ?? []),
    "products",
    "items",
    "product",
    "categories",
    "category",
    "attributes",
    "attribute",
    "facets",
    "facet",
    "data",
  ].filter((key): key is string => Boolean(key));

  for (const key of candidateKeys) {
    if (!(key in record)) continue;
    return normalizeProductArray(record[key], `JSON field "${key}"`);
  }

  throw new ImportParseError(
    "JSON root must be an array of product objects or contain a products/items array",
    "JSON",
  );
}

export async function* parseJson(
  content: string,
  options: JsonParseOptions = {},
): AsyncGenerator<ImportRow> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new ImportParseError(`Malformed JSON: ${message}`, "JSON");
  }

  const products = extractJsonProducts(parsed, options);
  if (products.length === 0) {
    return;
  }

  for (let index = 0; index < products.length; index++) {
    const rawData = products[index];
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      throw new ImportParseError(
        `JSON product at index ${index} must be an object`,
        "JSON",
      );
    }

    yield {
      rawRowIndex: index + 1,
      rawData,
      fields: flattenObject(rawData),
    };
  }
}

function resolveXmlRoot(
  parsed: Record<string, unknown>,
  options: XmlParseOptions,
): { rootElement: string; rootValue: Record<string, unknown> } {
  if (options.rootElement) {
    const rootValue = parsed[options.rootElement];
    if (!rootValue || typeof rootValue !== "object" || Array.isArray(rootValue)) {
      throw new ImportParseError(`XML root element <${options.rootElement}> is missing`, "XML");
    }
    return { rootElement: options.rootElement, rootValue: rootValue as Record<string, unknown> };
  }

  const rootElement = Object.keys(parsed).find((key) => key !== "?xml");
  if (!rootElement) {
    throw new ImportParseError("XML document is empty", "XML");
  }

  const rootValue = parsed[rootElement];
  if (!rootValue || typeof rootValue !== "object" || Array.isArray(rootValue)) {
    throw new ImportParseError(`XML root element <${rootElement}> is missing`, "XML");
  }

  return { rootElement, rootValue: rootValue as Record<string, unknown> };
}

function extractXmlProducts(
  parsed: Record<string, unknown>,
  options: XmlParseOptions,
): unknown[] {
  const { rootValue } = resolveXmlRoot(parsed, options);

  const productElement = options.productElement ?? "product";
  const products = rootValue[productElement];
  return normalizeProductArray(products, `XML <${productElement}> elements`);
}

export async function* parseXml(
  content: string,
  options: XmlParseOptions = {},
): AsyncGenerator<ImportRow> {
  const parser = new XMLParser({
    ignoreAttributes: true,
    trimValues: true,
    parseTagValue: true,
    isArray: (_tagName, jPath) => {
      const path = String(jPath);
      return (
        path.endsWith(".product") ||
        path === "products.product" ||
        path.endsWith(".category") ||
        path === "categories.category" ||
        path.endsWith(".attribute") ||
        path === "attributes.attribute" ||
        path.endsWith(".facet") ||
        path === "facets.facet"
      );
    },
  });

  let parsed: Record<string, unknown>;
  try {
    const result = parser.parse(content);
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new ImportParseError("Malformed XML: expected a single root element", "XML");
    }
    parsed = result as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ImportParseError) throw error;
    const message = error instanceof Error ? error.message : "Invalid XML";
    throw new ImportParseError(`Malformed XML: ${message}`, "XML");
  }

  const products = extractXmlProducts(parsed, options);
  if (products.length === 0) {
    return;
  }

  for (let index = 0; index < products.length; index++) {
    const rawData = products[index];
    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      throw new ImportParseError(
        `XML product at index ${index} must be an object`,
        "XML",
      );
    }

    yield {
      rawRowIndex: index + 1,
      rawData,
      fields: flattenObject(rawData),
    };
  }
}

export async function collectImportRows(
  generator: AsyncGenerator<ImportRow>,
): Promise<ImportRow[]> {
  const rows: ImportRow[] = [];
  for await (const row of generator) {
    rows.push(row);
  }
  return rows;
}
