export type ImportExampleFileType = "CSV" | "JSON" | "XML";

export interface ProductImportTemplateMapping {
  sourceColumn: string;
  targetField: string;
  isRequired?: boolean;
}

/** Core product columns for import templates and sample files. Add new fields here. */
export const PRODUCT_IMPORT_CORE_FIELDS = [
  { key: "sku", required: true },
  { key: "product_type", required: true },
  { key: "title", required: true },
  { key: "description", required: false },
  { key: "brand", required: false },
  { key: "parent_sku", required: false },
  { key: "category_code", required: false },
  { key: "summary", required: false },
  { key: "selling_points", required: false },
  { key: "start_date", required: false },
  { key: "discontinue_date", required: false },
] as const;

/** Demo attribute columns included in sample import files. Add new attribute examples here. */
export const PRODUCT_IMPORT_ATTRIBUTE_FIELDS = [
  { key: "color", required: false },
  { key: "size", required: false },
  { key: "fabric", required: false },
  { key: "fit", required: false },
  { key: "price", required: false },
  { key: "material", required: false },
] as const;

/**
 * Facet keys illustrated in sample downloads. Facets are derived from attributes at
 * search index time; CSV includes `facet_*` reference columns that are not part of
 * the default import template mappings.
 */
export const PRODUCT_IMPORT_FACET_FIELDS = [
  { key: "brand", required: false },
  { key: "color", required: false },
  { key: "size", required: false },
  { key: "fabric", required: false },
  { key: "fit", required: false },
  { key: "price", required: false },
  { key: "material", required: false },
] as const;

export const PRODUCT_IMPORT_CORE_FIELD_KEYS = PRODUCT_IMPORT_CORE_FIELDS.map((field) => field.key);
export const PRODUCT_IMPORT_ATTRIBUTE_FIELD_KEYS = PRODUCT_IMPORT_ATTRIBUTE_FIELDS.map(
  (field) => field.key,
);
export const PRODUCT_IMPORT_FACET_FIELD_KEYS = PRODUCT_IMPORT_FACET_FIELDS.map((field) => field.key);
export const PRODUCT_IMPORT_FACET_SAMPLE_COLUMN_KEYS = PRODUCT_IMPORT_FACET_FIELD_KEYS.map(
  (key) => `facet_${key}`,
);
export const PRODUCT_IMPORT_SAMPLE_FIELD_KEYS = [
  ...PRODUCT_IMPORT_CORE_FIELD_KEYS,
  ...PRODUCT_IMPORT_ATTRIBUTE_FIELD_KEYS,
  ...PRODUCT_IMPORT_FACET_SAMPLE_COLUMN_KEYS,
] as const;

export type ProductImportCoreFieldKey = (typeof PRODUCT_IMPORT_CORE_FIELDS)[number]["key"];
export type ProductImportAttributeFieldKey = (typeof PRODUCT_IMPORT_ATTRIBUTE_FIELDS)[number]["key"];
export type ProductImportFacetFieldKey = (typeof PRODUCT_IMPORT_FACET_FIELDS)[number]["key"];

export interface ImportExampleProduct {
  sku: string;
  product_type: string;
  title: string;
  description?: string;
  brand?: string;
  parent_sku?: string;
  category_code?: string;
  summary?: string;
  selling_points?: string[];
  start_date?: string;
  discontinue_date?: string;
  attributes?: Record<string, string>;
  facets?: Record<string, string>;
}

const BASE_EXAMPLE_PRODUCTS: ImportExampleProduct[] = [
  {
    sku: "EXAMPLE-001",
    product_type: "SIMPLE",
    title: "Import Oxford Shirt",
    description: "A classic oxford shirt for everyday wear.",
    brand: "Demo Brand",
    category_code: "oxford",
    summary: "Classic oxford shirt with a comfortable everyday fit.",
    selling_points: ["Quality fabric", "Easy care", "Classic fit"],
    start_date: "2025-01-01",
    discontinue_date: "2027-12-31",
    attributes: {
      color: "Blue",
      size: "M",
      fabric: "Cotton",
      fit: "Regular",
      price: "49.99",
      material: "Cotton",
    },
  },
  {
    sku: "EXAMPLE-002",
    product_type: "SIMPLE",
    title: "Import Cotton Tee",
    description: "Soft cotton tee for casual wear.",
    brand: "Demo Brand",
    category_code: "oxford",
    summary: "Soft cotton tee with a relaxed fit for daily wear.",
    selling_points: ["Soft cotton", "Breathable", "Everyday essential"],
    start_date: "2025-02-01",
    discontinue_date: "2028-06-30",
    attributes: {
      color: "White",
      size: "L",
      fabric: "Cotton",
      fit: "Relaxed",
      price: "24.99",
      material: "Cotton",
    },
  },
  {
    sku: "EXAMPLE-003",
    product_type: "PARENT",
    title: "Import Oxford Shirt Family",
    description: "Parent product grouping oxford shirt variants by size and color.",
    brand: "Demo Brand",
    category_code: "oxford",
    summary: "Oxford shirt available in multiple sizes and colors.",
    selling_points: ["Multiple fits", "Coordinated variants", "Easy merchandising"],
    start_date: "2025-01-01",
    discontinue_date: "2027-12-31",
  },
  {
    sku: "EXAMPLE-004",
    product_type: "VARIANT",
    title: "Import Oxford Shirt — Blue / M",
    description: "Oxford shirt variant in blue, size medium.",
    brand: "Demo Brand",
    parent_sku: "EXAMPLE-003",
    category_code: "oxford",
    summary: "Blue oxford shirt in size medium.",
    selling_points: ["Quality fabric", "Easy care"],
    start_date: "2025-01-01",
    discontinue_date: "2027-12-31",
    attributes: {
      color: "Blue",
      size: "M",
      fabric: "Cotton",
      fit: "Regular",
      price: "49.99",
      material: "Cotton",
    },
  },
  {
    sku: "EXAMPLE-005",
    product_type: "VARIANT",
    title: "Import Oxford Shirt — White / L",
    description: "Oxford shirt variant in white, size large.",
    brand: "Demo Brand",
    parent_sku: "EXAMPLE-003",
    category_code: "oxford",
    summary: "White oxford shirt in size large.",
    selling_points: ["Quality fabric", "Easy care"],
    start_date: "2025-01-01",
    discontinue_date: "2027-12-31",
    attributes: {
      color: "White",
      size: "L",
      fabric: "Cotton",
      fit: "Regular",
      price: "49.99",
      material: "Cotton",
    },
  },
];

function exampleSku(prefix: string, sku: string): string {
  return sku.replace(/^EXAMPLE-/, `${prefix}-`);
}

function priceFacetBucket(priceValue: string | undefined): string | undefined {
  const price = Number.parseFloat(priceValue ?? "");
  if (Number.isNaN(price)) return undefined;
  if (price < 25) return "under_25";
  if (price < 50) return "25_to_50";
  if (price < 100) return "50_to_100";
  if (price < 200) return "100_to_200";
  return "200_plus";
}

export function deriveExampleFacets(product: ImportExampleProduct): Record<string, string> {
  const facets: Record<string, string> = {};

  if (product.brand) facets.brand = product.brand;

  for (const key of PRODUCT_IMPORT_FACET_FIELD_KEYS) {
    if (key === "brand" || key === "price") continue;
    const value = product.attributes?.[key];
    if (value) facets[key] = value;
  }

  const priceBucket = priceFacetBucket(product.attributes?.price);
  if (priceBucket) facets.price = priceBucket;

  return { ...facets, ...product.facets };
}

export function importExampleProducts(fileType: ImportExampleFileType): ImportExampleProduct[] {
  const prefix = fileType;
  return BASE_EXAMPLE_PRODUCTS.map((product) => {
    const sku = exampleSku(prefix, product.sku);
    const parentSku = product.parent_sku ? exampleSku(prefix, product.parent_sku) : undefined;
    const withSkus = {
      ...product,
      sku,
      ...(parentSku ? { parent_sku: parentSku } : {}),
    };

    return {
      ...withSkus,
      facets: deriveExampleFacets(withSkus),
    };
  });
}

export function buildDefaultTemplateMappings(): ProductImportTemplateMapping[] {
  const coreMappings = PRODUCT_IMPORT_CORE_FIELDS.map((field) => ({
    sourceColumn: field.key,
    targetField: field.key,
    isRequired: field.required,
  }));

  const flatAttributeMappings = PRODUCT_IMPORT_ATTRIBUTE_FIELDS.map((field) => ({
    sourceColumn: field.key,
    targetField: field.key,
    isRequired: field.required,
  }));

  const nestedAttributeMappings = PRODUCT_IMPORT_ATTRIBUTE_FIELDS.map((field) => ({
    sourceColumn: `attributes.${field.key}`,
    targetField: field.key,
    isRequired: field.required,
  }));

  return [...coreMappings, ...flatAttributeMappings, ...nestedAttributeMappings];
}

/** Ensure canonical import mappings exist even when a stored template predates new fields. */
export function mergeTemplateMappings(
  mappings: ProductImportTemplateMapping[],
  defaults: ProductImportTemplateMapping[] = buildDefaultTemplateMappings(),
): ProductImportTemplateMapping[] {
  const merged = new Map<string, ProductImportTemplateMapping>();
  for (const mapping of defaults) {
    merged.set(mapping.sourceColumn, mapping);
  }
  for (const mapping of mappings) {
    merged.set(mapping.sourceColumn, mapping);
  }
  return [...merged.values()];
}

export function parseImportSellingPoints(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to delimiter parsing.
    }
  }

  const delimiter = trimmed.includes("|") ? "|" : trimmed.includes(",") ? "," : null;
  if (delimiter) {
    return trimmed
      .split(delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [trimmed];
}

export function parseImportDate(value: string | undefined): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00.000Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function isAttributeFieldKey(key: string): key is ProductImportAttributeFieldKey {
  return (PRODUCT_IMPORT_ATTRIBUTE_FIELD_KEYS as readonly string[]).includes(key);
}

function productToCsvRow(product: ImportExampleProduct): string {
  const facets = deriveExampleFacets(product);
  const values = PRODUCT_IMPORT_SAMPLE_FIELD_KEYS.map((key) => {
    if (key === "selling_points") {
      return csvEscape((product.selling_points ?? []).join("|"));
    }
    if (isAttributeFieldKey(key)) {
      return csvEscape(product.attributes?.[key] ?? "");
    }
    if (key.startsWith("facet_")) {
      const facetKey = key.slice("facet_".length) as ProductImportFacetFieldKey;
      return csvEscape(facets[facetKey] ?? "");
    }
    const value = product[key as keyof ImportExampleProduct];
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return csvEscape(JSON.stringify(value));
    }
    return csvEscape(value ? String(value) : "");
  });
  return values.join(",");
}

export function buildImportExampleCsv(fileType: ImportExampleFileType = "CSV"): string {
  const products = importExampleProducts(fileType);
  const header = PRODUCT_IMPORT_SAMPLE_FIELD_KEYS.join(",");
  const rows = products.map(productToCsvRow);
  return `${[header, ...rows].join("\n")}\n`;
}

export function buildImportExampleJson(fileType: ImportExampleFileType = "JSON"): string {
  const products = importExampleProducts(fileType).map(
    ({ attributes, facets, selling_points, ...product }) => ({
      ...product,
      ...(selling_points ? { selling_points } : {}),
      ...(attributes && Object.keys(attributes).length > 0 ? { attributes } : {}),
      ...(facets && Object.keys(facets).length > 0 ? { facets } : {}),
    }),
  );
  return `${JSON.stringify(products, null, 2)}\n`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlElement(name: string, value: string, indent = 4): string {
  const pad = " ".repeat(indent);
  return `${pad}<${name}>${escapeXml(value)}</${name}>`;
}

function buildXmlRecordBlock(
  blockName: string,
  values: Record<string, string>,
  indent = 4,
): string[] {
  const lines = [`${" ".repeat(indent)}<${blockName}>`];
  for (const [key, value] of Object.entries(values)) {
    lines.push(xmlElement(key, value, indent + 2));
  }
  lines.push(`${" ".repeat(indent)}</${blockName}>`);
  return lines;
}

function buildXmlProduct(product: ImportExampleProduct): string {
  const facets = deriveExampleFacets(product);
  const lines = [
    xmlElement("sku", product.sku),
    xmlElement("product_type", product.product_type),
    xmlElement("title", product.title),
  ];

  if (product.description) lines.push(xmlElement("description", product.description));
  if (product.brand) lines.push(xmlElement("brand", product.brand));
  if (product.parent_sku) lines.push(xmlElement("parent_sku", product.parent_sku));
  if (product.category_code) lines.push(xmlElement("category_code", product.category_code));
  if (product.summary) lines.push(xmlElement("summary", product.summary));
  if (product.selling_points?.length) {
    lines.push(xmlElement("selling_points", product.selling_points.join("|")));
  }
  if (product.start_date) lines.push(xmlElement("start_date", product.start_date));
  if (product.discontinue_date) lines.push(xmlElement("discontinue_date", product.discontinue_date));
  if (product.attributes && Object.keys(product.attributes).length > 0) {
    lines.push(...buildXmlRecordBlock("attributes", product.attributes));
  }
  if (Object.keys(facets).length > 0) {
    lines.push(...buildXmlRecordBlock("facets", facets));
  }

  return `  <product>\n${lines.join("\n")}\n  </product>`;
}

export function buildImportExampleXml(fileType: ImportExampleFileType = "XML"): string {
  const products = importExampleProducts(fileType);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<products>\n${products.map(buildXmlProduct).join("\n")}\n</products>\n`;
}

const IMPORT_EXAMPLE_MIME_TYPES: Record<ImportExampleFileType, string> = {
  CSV: "text/csv",
  JSON: "application/json",
  XML: "application/xml",
};

const IMPORT_EXAMPLE_FILE_NAMES: Record<ImportExampleFileType, string> = {
  CSV: "products-example.csv",
  JSON: "products-example.json",
  XML: "products-example.xml",
};

export function buildImportExampleFile(fileType: ImportExampleFileType): {
  fileName: string;
  mimeType: string;
  content: string;
} {
  const builders: Record<ImportExampleFileType, () => string> = {
    CSV: () => buildImportExampleCsv(fileType),
    JSON: () => buildImportExampleJson(fileType),
    XML: () => buildImportExampleXml(fileType),
  };

  return {
    fileName: IMPORT_EXAMPLE_FILE_NAMES[fileType],
    mimeType: IMPORT_EXAMPLE_MIME_TYPES[fileType],
    content: builders[fileType](),
  };
}

export const IMPORT_EXAMPLE_FILE_TYPES: ImportExampleFileType[] = ["CSV", "JSON", "XML"];
