import type { ImportFileType } from "@productinfoman/domain";

const IMPORT_EXAMPLES: Record<ImportFileType, { fileName: string; content: string; mimeType: string }> =
  {
    CSV: {
      fileName: "products-example.csv",
      mimeType: "text/csv",
      content: `sku,product_type,title,category_code,color,size
CSV-001,SIMPLE,CSV Import Shirt,oxford,Blue,M
CSV-002,SIMPLE,CSV Import Tee,oxford,White,L
`,
    },
    JSON: {
      fileName: "products-example.json",
      mimeType: "application/json",
      content: `[
  {
    "sku": "JSON-001",
    "product_type": "SIMPLE",
    "title": "JSON Import Shirt",
    "category_code": "oxford",
    "attributes": {
      "color": "Blue",
      "size": "M"
    }
  },
  {
    "sku": "JSON-002",
    "product_type": "SIMPLE",
    "title": "JSON Import Tee",
    "category_code": "oxford",
    "attributes": {
      "color": "White",
      "size": "L"
    }
  }
]
`,
    },
    XML: {
      fileName: "products-example.xml",
      mimeType: "application/xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<products>
  <product>
    <sku>XML-001</sku>
    <product_type>SIMPLE</product_type>
    <title>XML Import Shirt</title>
    <category_code>oxford</category_code>
    <attributes>
      <color>Navy</color>
      <size>S</size>
    </attributes>
  </product>
  <product>
    <sku>XML-002</sku>
    <product_type>SIMPLE</product_type>
    <title>XML Import Polo</title>
    <category_code>oxford</category_code>
    <attributes>
      <color>Gray</color>
      <size>M</size>
    </attributes>
  </product>
</products>
`,
    },
  };

export const IMPORT_EXAMPLE_TYPES = Object.keys(IMPORT_EXAMPLES) as ImportFileType[];

export function downloadImportExample(fileType: ImportFileType): void {
  const example = IMPORT_EXAMPLES[fileType];
  const blob = new Blob([example.content], { type: example.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = example.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
