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

function isInternalHealthRequest(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  const token = process.env.HEALTH_INTERNAL_TOKEN;
  if (!token) return false;
  const header = request.headers["x-health-token"];
  return typeof header === "string" && header === token;
}

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (request, reply) => {
    const [database, redis, search] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkSearch(),
    ]);

    const ready = database === "ok" && redis !== "error";
    const status = ready ? "ok" : "error";

    if (!ready) {
      if (isInternalHealthRequest(request)) {
        return reply.code(503).send({ status, checks: { database, redis, search } });
      }
      return reply.code(503).send({ status: "error" });
    }

    if (isInternalHealthRequest(request)) {
      return { status, checks: { database, redis, search } };
    }

    return { status: "ok" };
  });

  app.get("/health", async () => ({ status: "ok" }));
}
