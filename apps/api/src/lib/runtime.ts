import { loadApiEnv } from "@productinfoman/config";
import { prisma } from "@productinfoman/db";
import { withTimeout } from "./resilience/timeout.js";

let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function markShuttingDown(): void {
  shuttingDown = true;
}

export async function withDbTimeout<T>(operation: () => Promise<T>): Promise<T> {
  const { DB_QUERY_TIMEOUT_MS } = loadApiEnv();
  return withTimeout(operation(), DB_QUERY_TIMEOUT_MS, "dbQuery");
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await withDbTimeout(() => prisma.$queryRaw`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
