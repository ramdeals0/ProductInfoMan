import type { FastifyInstance } from "fastify";
import { prisma } from "@productinfoman/db";
import { getRedisClient, isRedisConfigured } from "../lib/redis.js";
import { withTimeout } from "../lib/resilience/timeout.js";
import { loadApiEnv } from "@productinfoman/config";

type HealthStatus = "ok" | "degraded" | "error";

async function checkDatabase(): Promise<HealthStatus> {
  const { DB_QUERY_TIMEOUT_MS } = loadApiEnv();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DB_QUERY_TIMEOUT_MS, "dbPing");
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<HealthStatus> {
  if (!isRedisConfigured()) return "degraded";
  try {
    const client = await getRedisClient();
    if (!client) return "degraded";
    const { REDIS_COMMAND_TIMEOUT_MS } = loadApiEnv();
    const pong = await withTimeout(client.ping(), REDIS_COMMAND_TIMEOUT_MS, "redisPing");
    return pong === "PONG" ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function checkSearch(): Promise<HealthStatus> {
  if (!process.env.OPENSEARCH_URL) return "degraded";
  try {
    const { REDIS_COMMAND_TIMEOUT_MS } = loadApiEnv();
    const response = await withTimeout(
      fetch(`${process.env.OPENSEARCH_URL}/_cluster/health`),
      REDIS_COMMAND_TIMEOUT_MS,
      "searchHealth",
    );
    return response.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    const [database, redis, search] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkSearch(),
    ]);

    const checks = { database, redis, search };
    const ready = database === "ok" && redis !== "error";
    const status = ready ? "ok" : "error";

    if (!ready) {
      return reply.code(503).send({ status, checks });
    }

    return { status, checks };
  });

  app.get("/health", async () => ({ status: "ok" }));
}
