import { adminEnvSchema, apiEnvSchema, type AdminEnv, type ApiEnv } from "./env.schema";

function formatZodError(error: { issues: Array<{ path: (string | number)[]; message: string }> }): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

let cachedApiEnv: ApiEnv | null = null;
let cachedAdminEnv: AdminEnv | null = null;

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  if (cachedApiEnv) return cachedApiEnv;

  const isTest = env.NODE_ENV === "test" || env.VITEST === "true";
  const input = {
    ...env,
    JWT_SECRET:
      env.JWT_SECRET ??
      (isTest ? "test-jwt-secret-with-32-chars-minimum!!" : undefined),
    DATABASE_URL:
      env.DATABASE_URL ??
      (isTest ? "postgresql://postgres:postgres@localhost:5432/productinfoman?schema=public" : undefined),
  };

  const parsed = apiEnvSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid API configuration: ${formatZodError(parsed.error)}`);
  }

  cachedApiEnv = parsed.data;
  return parsed.data;
}

export function loadAdminEnv(env: NodeJS.ProcessEnv = process.env): AdminEnv {
  if (cachedAdminEnv) return cachedAdminEnv;

  const isTest = env.NODE_ENV === "test" || env.VITEST === "true";
  const input = {
    ...env,
    JWT_SECRET:
      env.JWT_SECRET ??
      (isTest ? "test-jwt-secret-with-32-chars-minimum!!" : undefined),
  };

  const parsed = adminEnvSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid admin configuration: ${formatZodError(parsed.error)}`);
  }

  cachedAdminEnv = parsed.data;
  return parsed.data;
}

export function resetEnvCacheForTests(): void {
  cachedApiEnv = null;
  cachedAdminEnv = null;
}
