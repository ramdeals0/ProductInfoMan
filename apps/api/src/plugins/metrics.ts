import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { loadApiEnv } from "@productinfoman/config";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpRequestDuration = new Histogram({
  name: "pim_http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["service", "method", "route", "status_code"] as const,
  buckets: [0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2],
  registers: [registry],
});

const httpRequestTotal = new Counter({
  name: "pim_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["service", "method", "route", "status_code"] as const,
  registers: [registry],
});

const workerJobDuration = new Histogram({
  name: "pim_worker_job_duration_seconds",
  help: "Background worker job duration",
  labelNames: ["worker", "status"] as const,
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [registry],
});

const workerJobsTotal = new Counter({
  name: "pim_worker_jobs_total",
  help: "Background worker jobs processed",
  labelNames: ["worker", "status"] as const,
  registers: [registry],
});

const queueDepthGauge = new Gauge({
  name: "pim_queue_depth",
  help: "Approximate queue depth by state",
  labelNames: ["queue", "state"] as const,
  registers: [registry],
});

export function observeWorkerJob(
  worker: string,
  status: "success" | "failure",
  startedAt: number,
): void {
  const durationSec = (Date.now() - startedAt) / 1000;
  workerJobDuration.observe({ worker, status }, durationSec);
  workerJobsTotal.inc({ worker, status });
}

export function setQueueDepthMetrics(
  queue: string,
  depth: { waiting: number; active: number; delayed: number },
): void {
  queueDepthGauge.set({ queue, state: "waiting" }, depth.waiting);
  queueDepthGauge.set({ queue, state: "active" }, depth.active);
  queueDepthGauge.set({ queue, state: "delayed" }, depth.delayed);
}

function routeLabel(request: FastifyRequest): string {
  return request.routeOptions?.url ?? request.url.split("?")[0] ?? "unknown";
}

export async function registerMetricsPlugin(app: FastifyInstance): Promise<void> {
  const { METRICS_ENABLED } = loadApiEnv();
  if (METRICS_ENABLED !== "true") return;

  app.addHook("onResponse", async (request, reply) => {
    const labels = {
      service: "api",
      method: request.method,
      route: routeLabel(request),
      status_code: String(reply.statusCode),
    };
    httpRequestTotal.inc(labels);
    httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
  });

  app.get("/metrics", async (_request, reply: FastifyReply) => {
    reply.header("Content-Type", registry.contentType);
    return reply.send(await registry.metrics());
  });
}

export function getMetricsRegistry(): Registry {
  return registry;
}
