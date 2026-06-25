import type { ImportFileType } from "@productinfoman/domain";
import {
  buildImportExampleFile,
  IMPORT_EXAMPLE_FILE_TYPES,
} from "@productinfoman/import-engine/examples";

export const IMPORT_EXAMPLE_TYPES = IMPORT_EXAMPLE_FILE_TYPES;

export function downloadImportExample(fileType: ImportFileType): void {
  const example = buildImportExampleFile(fileType);
  const blob = new Blob([example.content], { type: example.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = example.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
