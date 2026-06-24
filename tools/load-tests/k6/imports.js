import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { authHeaders, loginAndGetToken, thresholds } from "./lib.js";

const importLatency = new Trend("import_latency", true);
const importErrors = new Rate("import_errors");

export const options = {
  scenarios: {
    bulk_import: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "15m",
    },
  },
  thresholds: {
    ...thresholds,
    import_latency: ["p(95)<2000"],
    import_errors: ["rate<0.1"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const ORG_SLUG = __ENV.ORG_SLUG || "demo";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@demo.local";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "Admin123!@#demo";

function buildCsv(rows) {
  const header = "sku,title,description,brand,status\n";
  const lines = [];
  for (let i = 0; i < rows; i += 1) {
    lines.push(`LOAD-${Date.now()}-${i},Load Test Product ${i},Desc ${i},LoadBrand,DRAFT`);
  }
  return header + lines.join("\n");
}

export function setup() {
  const token = loginAndGetToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ORG_SLUG);
  if (!token) throw new Error("Admin login failed");
  return { token };
}

export default function bulkImport(data) {
  const rowCount = Number(__ENV.IMPORT_ROWS || 500);
  const csvBody = buildCsv(rowCount);

  const formData =
    `------k6boundary\r\n` +
    `Content-Disposition: form-data; name="file"; filename="load-test.csv"\r\n` +
    `Content-Type: text/csv\r\n\r\n` +
    `${csvBody}\r\n` +
    `------k6boundary\r\n` +
    `Content-Disposition: form-data; name="importType"\r\n\r\n` +
    `CREATE\r\n` +
    `------k6boundary--\r\n`;

  const uploadRes = http.post(`${BASE_URL}/api/v1/imports/upload`, formData, {
    headers: {
      Authorization: `Bearer ${data.token}`,
      "x-organization-slug": ORG_SLUG,
      "Content-Type": "multipart/form-data; boundary=----k6boundary",
    },
  });
  importLatency.add(uploadRes.timings.duration);
  importErrors.add(uploadRes.status >= 400);
  check(uploadRes, { "upload 201": (r) => r.status === 201 });

  if (uploadRes.status !== 201) return;

  const job = uploadRes.json();
  const validateRes = http.post(`${BASE_URL}/api/v1/imports/${job.id}/validate`, null, {
    headers: authHeaders(data.token, ORG_SLUG),
  });
  check(validateRes, { "validate 200": (r) => r.status === 200 });

  const startRes = http.post(`${BASE_URL}/api/v1/imports/${job.id}/start`, null, {
    headers: authHeaders(data.token, ORG_SLUG),
  });
  importLatency.add(startRes.timings.duration);
  importErrors.add(startRes.status >= 400);
  check(startRes, {
    "start accepted": (r) => r.status === 200 || r.status === 202 || r.status === 429,
  });

  sleep(5);
}
