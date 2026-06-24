import type Redis from "ioredis";

let redisClient: Redis | null = null;

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export async function getRedisClient(): Promise<Redis | null> {
  if (!isRedisConfigured()) return null;
  if (redisClient) return redisClient;

  const { default: IORedis } = await import("ioredis");
  redisClient = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  await redisClient.connect();
  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) return;
  await redisClient.quit();
  redisClient = null;
}
