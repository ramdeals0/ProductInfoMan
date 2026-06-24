import { loadApiEnv } from "@productinfoman/config";
import { getRedisClient } from "./redis.js";
import { withTimeout } from "./resilience/timeout.js";

const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function cacheKey(namespace: string, id: string): string {
  return `cache:${namespace}:${id}`;
}

export async function cacheGet<T>(namespace: string, id: string): Promise<T | null> {
  const key = cacheKey(namespace, id);
  const redis = await getRedisClient();
  const { REDIS_COMMAND_TIMEOUT_MS } = loadApiEnv();

  if (redis) {
    try {
      const raw = await withTimeout(redis.get(key), REDIS_COMMAND_TIMEOUT_MS, "cacheGet");
      return raw && typeof raw === "string" ? (JSON.parse(raw) as T) : null;
    } catch {
      // fall through to memory
    }
  }

  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet<T>(
  namespace: string,
  id: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const key = cacheKey(namespace, id);
  const payload = JSON.stringify(value);
  const redis = await getRedisClient();
  const { REDIS_COMMAND_TIMEOUT_MS } = loadApiEnv();

  if (redis) {
    try {
      await withTimeout(redis.set(key, payload, "EX", ttlSeconds), REDIS_COMMAND_TIMEOUT_MS, "cacheSet");
      return;
    } catch {
      // fall through to memory
    }
  }

  memoryCache.set(key, { value: payload, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export async function cacheDelete(namespace: string, id: string): Promise<void> {
  const key = cacheKey(namespace, id);
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
  memoryCache.delete(key);
}

export function resetMemoryCacheForTests(): void {
  memoryCache.clear();
}
