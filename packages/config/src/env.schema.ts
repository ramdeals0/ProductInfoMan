import { z } from "zod";

const urlSchema = z.string().url();
const postgresUrlSchema = z
  .string()
  .regex(/^postgres(ql)?:\/\/.+/, "DATABASE_URL must be a PostgreSQL connection URL");
const redisUrlSchema = z.string().regex(/^redis(s)?:\/\/.+/, "REDIS_URL must be a Redis connection URL");

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: postgresUrlSchema,
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("30m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  PASSWORD_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(5).max(120).default(15),
  REDIS_URL: redisUrlSchema.optional(),
  IMPORT_SYNC: z.enum(["true", "false"]).default("false"),
  SEARCH_SYNC: z.enum(["true", "false"]).default("false"),
  PUBLISH_SYNC: z.enum(["true", "false"]).default("false"),
  EVENT_SYNC: z.enum(["true", "false"]).default("false"),
  OPENSEARCH_URL: urlSchema.optional(),
  JSON_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(2_097_152),
  CORS_ORIGINS: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  S3_ENDPOINT: urlSchema.optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  SECRET_PROVIDER: z.enum(["env"]).default("env"),
  METRICS_ENABLED: z.enum(["true", "false"]).default("true"),
  IMPORT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  PUBLISH_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  SEARCH_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  EVENT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  IMPORT_BATCH_SIZE: z.coerce.number().int().min(100).max(5000).default(500),
  PUBLISH_BATCH_SIZE: z.coerce.number().int().min(50).max(2000).default(200),
  PUBLISH_BATCH_DELAY_MS: z.coerce.number().int().min(0).max(5000).default(50),
  HEAVY_JOB_QUEUE_THRESHOLD: z.coerce.number().int().min(10).max(500).default(50),
  CACHE_CATEGORY_TREE_TTL_SEC: z.coerce.number().int().min(60).max(3600).default(300),
  REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(3000),
  DB_QUERY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce.number().int().min(2).max(50).default(5),
  CIRCUIT_BREAKER_COOLDOWN_MS: z.coerce.number().int().min(5000).max(300000).default(30000),
});

export const adminEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_URL: urlSchema.default("http://localhost:3001"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_DEFAULT_ORG_SLUG: z.string().min(1).default("demo"),
  NEXT_PUBLIC_ADMIN_EMAIL: z.string().email().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type AdminEnv = z.infer<typeof adminEnvSchema>;
