import type Redis from "ioredis";
import { loadApiEnv } from "@productinfoman/config";

let redisClient: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export async function getRedisClient(): Promise<Redis | null> {
  if (!isRedisConfigured()) return null;
  if (redisClient) return redisClient;

  const { REDIS_COMMAND_TIMEOUT_MS } = loadApiEnv();
  const { default: IORedis } = await import("ioredis");
  redisClient = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    connectTimeout: REDIS_COMMAND_TIMEOUT_MS,
    commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
  });
  await redisClient.connect();
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) return;
  await redisClient.quit();
  redisClient = null;
}
