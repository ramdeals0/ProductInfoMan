import type { ImportEntityType, ImportFileType } from "@productinfoman/domain";
import {
  buildImportExampleFile,
  IMPORT_EXAMPLE_FILE_TYPES,
} from "@productinfoman/import-engine/examples";
import { buildTaxonomyImportExample } from "@productinfoman/import-engine/taxonomy-examples";

export const IMPORT_EXAMPLE_TYPES = IMPORT_EXAMPLE_FILE_TYPES;

export const IMPORT_ENTITY_TYPE_OPTIONS: Array<{ value: ImportEntityType; label: string }> = [
  { value: "PRODUCT", label: "Products" },
  { value: "CATEGORY", label: "Categories" },
  { value: "ATTRIBUTE", label: "Attributes" },
  { value: "FACET", label: "Facets" },
];

export function downloadImportExample(
  entityType: ImportEntityType,
  fileType: ImportFileType,
): void {
  const example =
    entityType === "PRODUCT" || entityType === "VARIANT"
      ? buildImportExampleFile(fileType)
      : buildTaxonomyImportExample(entityType, fileType);
  const blob = new Blob([example.content], { type: example.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = example.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
