import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { authHeaders, loginAndGetToken, thresholds } from "./lib.js";

const readLatency = new Trend("product_read_latency", true);
const writeLatency = new Trend("product_write_latency", true);
const crudErrors = new Rate("product_crud_errors");

export const options = {
  scenarios: {
    admin_crud: {
      executor: "constant-vus",
      vus: 10,
      duration: "3m",
    },
  },
  thresholds: {
    ...thresholds,
    product_read_latency: ["p(95)<400"],
    product_write_latency: ["p(95)<500"],
    product_crud_errors: ["rate<0.03"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const ORG_SLUG = __ENV.ORG_SLUG || "demo";
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@demo.local";
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "Admin123!@#demo";

let productIds = [];

export function setup() {
  const token = loginAndGetToken(BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ORG_SLUG);
  if (!token) {
    throw new Error("Admin login failed — set ADMIN_EMAIL and ADMIN_PASSWORD");
  }

  const listRes = http.get(`${BASE_URL}/api/v1/products?page=1&pageSize=50`, {
    headers: authHeaders(token, ORG_SLUG),
  });
  const body = listRes.json();
  productIds = (body.items || []).map((p) => p.id).filter(Boolean);
  if (productIds.length === 0) {
    console.warn("No products found — seed demo catalog before running load tests");
  }
  return { token };
}

export default function adminProductCrud(data) {
  const token = data.token;
  const headers = authHeaders(token, ORG_SLUG);

  const listRes = http.get(`${BASE_URL}/api/v1/products?page=1&pageSize=20`, { headers });
  readLatency.add(listRes.timings.duration);
  crudErrors.add(listRes.status >= 400);
  check(listRes, { "list products 200": (r) => r.status === 200 });

  if (productIds.length > 0) {
    const id = productIds[Math.floor(Math.random() * productIds.length)];
    const getRes = http.get(`${BASE_URL}/api/v1/products/${id}`, { headers });
    readLatency.add(getRes.timings.duration);
    crudErrors.add(getRes.status >= 400);
    check(getRes, { "get product 200": (r) => r.status === 200 });

    const patchRes = http.patch(
      `${BASE_URL}/api/v1/products/${id}`,
      JSON.stringify({ description: `Load test touch ${Date.now()}` }),
      { headers },
    );
    writeLatency.add(patchRes.timings.duration);
    crudErrors.add(patchRes.status >= 400);
    check(patchRes, { "patch product 2xx": (r) => r.status >= 200 && r.status < 300 });
  }

  sleep(1);
}
