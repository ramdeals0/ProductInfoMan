import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { authHeaders, loginAndGetToken, thresholds } from "./lib.js";

const publishLatency = new Trend("publish_latency", true);
const publishErrors = new Rate("publish_errors");

export const options = {
  scenarios: {
    publish_export: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "20m",
    },
  },
  thresholds: {
    ...thresholds,
    publish_latency: ["p(95)<3000"],
    publish_errors: ["rate<0.1"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const ORG_SLUG = __ENV.ORG_SLUG || "demo";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@demo.local";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "Admin123!@#demo";
const CHANNEL_ID = __ENV.CHANNEL_ID;

export function setup() {
  const token = loginAndGetToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ORG_SLUG);
  if (!token) throw new Error("Admin login failed");

  let channelId = CHANNEL_ID;
  if (!channelId) {
    const channelsRes = http.get(`${BASE_URL}/api/v1/channels`, {
      headers: authHeaders(token, ORG_SLUG),
    });
    const channels = channelsRes.json().items || [];
    channelId = channels[0]?.id;
  }
  if (!channelId) {
    throw new Error("No channel found — create a channel or set CHANNEL_ID");
  }

  return { token, channelId };
}

export default function publishExport(data) {
  const headers = authHeaders(data.token, ORG_SLUG);
  const mode = __ENV.PUBLISH_MODE || "DRY_RUN";

  const runRes = http.post(
    `${BASE_URL}/api/v1/publish/${mode === "LIVE" ? "run" : "dry-run"}`,
    JSON.stringify({ channelId: data.channelId }),
    { headers },
  );
  publishLatency.add(runRes.timings.duration);
  publishErrors.add(runRes.status >= 400);
  check(runRes, {
    "publish job created": (r) => r.status === 201 || r.status === 202 || r.status === 429,
  });

  if (runRes.status !== 201 && runRes.status !== 202) return;

  const job = runRes.json();
  const jobId = job.id || job.jobId;

  for (let i = 0; i < 60; i += 1) {
    const statusRes = http.get(`${BASE_URL}/api/v1/publish/jobs/${jobId}`, { headers });
    if (statusRes.status === 200) {
      const status = statusRes.json().status;
      if (status === "COMPLETED" || status === "FAILED") break;
    }
    sleep(5);
  }
}
