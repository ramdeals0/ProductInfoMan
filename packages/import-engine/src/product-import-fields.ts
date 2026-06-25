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
] as const;

export const PRODUCT_IMPORT_CORE_FIELD_KEYS = PRODUCT_IMPORT_CORE_FIELDS.map((field) => field.key);
export const PRODUCT_IMPORT_ATTRIBUTE_FIELD_KEYS = PRODUCT_IMPORT_ATTRIBUTE_FIELDS.map(
  (field) => field.key,
);
export const PRODUCT_IMPORT_SAMPLE_FIELD_KEYS = [
  ...PRODUCT_IMPORT_CORE_FIELD_KEYS,
  ...PRODUCT_IMPORT_ATTRIBUTE_FIELD_KEYS,
] as const;

export type ProductImportCoreFieldKey = (typeof PRODUCT_IMPORT_CORE_FIELDS)[number]["key"];
export type ProductImportAttributeFieldKey = (typeof PRODUCT_IMPORT_ATTRIBUTE_FIELDS)[number]["key"];

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
    attributes: { color: "Blue", size: "M" },
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
    attributes: { color: "White", size: "L" },
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
    attributes: { color: "Blue", size: "M" },
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
    attributes: { color: "White", size: "L" },
  },
];

function exampleSku(prefix: string, sku: string): string {
  return sku.replace(/^EXAMPLE-/, `${prefix}-`);
}

export function importExampleProducts(fileType: ImportExampleFileType): ImportExampleProduct[] {
  const prefix = fileType;
  return BASE_EXAMPLE_PRODUCTS.map((product) => ({
    ...product,
    sku: exampleSku(prefix, product.sku),
    ...(product.parent_sku
      ? { parent_sku: exampleSku(prefix, product.parent_sku) }
      : {}),
  }));
}

export function buildDefaultTemplateMappings(): ProductImportTemplateMapping[] {
  return [
    ...PRODUCT_IMPORT_CORE_FIELDS.map((field) => ({
      sourceColumn: field.key,
      targetField: field.key,
      isRequired: field.required,
    })),
    ...PRODUCT_IMPORT_ATTRIBUTE_FIELDS.map((field) => ({
      sourceColumn: field.key,
      targetField: field.key,
      isRequired: field.required,
    })),
  ];
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

function productToCsvRow(product: ImportExampleProduct): string {
  const values = PRODUCT_IMPORT_SAMPLE_FIELD_KEYS.map((key) => {
    if (key === "selling_points") {
      return csvEscape((product.selling_points ?? []).join("|"));
    }
    if (key === "color" || key === "size") {
      return csvEscape(product.attributes?.[key] ?? "");
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
    ({ attributes, selling_points, ...product }) => ({
      ...product,
      ...(selling_points ? { selling_points } : {}),
      ...(attributes ? { attributes } : {}),
    }),
  );
  return `${JSON.stringify(products, null, 2)}\n`;
}

function xmlElement(name: string, value: string): string {
  return `    <${name}>${value}</${name}>`;
}

function buildXmlProduct(product: ImportExampleProduct): string {
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
    lines.push("    <attributes>");
    for (const [key, value] of Object.entries(product.attributes)) {
      lines.push(xmlElement(key, value));
    }
    lines.push("    </attributes>");
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
