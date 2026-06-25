import type { ImportJobStatus } from "@productinfoman/domain";

export const ACTIVE_IMPORT_STATUSES: ImportJobStatus[] = ["VALIDATING", "QUEUED", "PROCESSING"];

export const IMPORT_POLL_INTERVAL_MS = 2000;

export function isActiveImportStatus(status: ImportJobStatus): boolean {
  return ACTIVE_IMPORT_STATUSES.includes(status);
}
