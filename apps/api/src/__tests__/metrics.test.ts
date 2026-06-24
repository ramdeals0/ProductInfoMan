import { describe, expect, it } from "vitest";
import { getMetricsRegistry } from "../plugins/metrics.js";

describe("metrics plugin", () => {
  it("exposes a Prometheus registry with HTTP and worker metrics", async () => {
    const registry = getMetricsRegistry();
    const metrics = await registry.metrics();
    expect(metrics).toContain("pim_http_request_duration_seconds");
    expect(metrics).toContain("pim_worker_job_duration_seconds");
    expect(metrics).toContain("pim_queue_depth");
  });
});
