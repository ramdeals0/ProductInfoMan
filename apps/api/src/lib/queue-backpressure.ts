import { loadApiEnv } from "@productinfoman/config";
import { getRedisClient } from "./redis.js";

export type QueueDepth = {
  waiting: number;
  active: number;
  delayed: number;
};

async function getBullQueueCounts(queueName: string): Promise<QueueDepth | null> {
  if (!process.env.REDIS_URL) return null;
  const redis = await getRedisClient();
  if (!redis) return null;

  const [waiting, active, delayed] = await Promise.all([
    redis.llen(`bull:${queueName}:wait`),
    redis.llen(`bull:${queueName}:active`),
    redis.zcard(`bull:${queueName}:delayed`),
  ]);

  return { waiting, active, delayed };
}

export async function getQueueDepth(queueName: string): Promise<QueueDepth> {
  const counts = await getBullQueueCounts(queueName);
  return counts ?? { waiting: 0, active: 0, delayed: 0 };
}

/** ASSUMPTION CHANGE: queue depth read via Redis key inspection; BullMQ API preferred when refactored. */
export async function assertHeavyJobCapacity(queueName: string): Promise<void> {
  const { HEAVY_JOB_QUEUE_THRESHOLD } = loadApiEnv();
  const depth = await getQueueDepth(queueName);
  const total = depth.waiting + depth.active + depth.delayed;
  if (total >= HEAVY_JOB_QUEUE_THRESHOLD) {
    throw Object.assign(
      new Error("Heavy job queue is at capacity. Retry later."),
      { statusCode: 429, code: "BACKPRESSURE", retryAfterSeconds: 60 },
    );
  }
}
