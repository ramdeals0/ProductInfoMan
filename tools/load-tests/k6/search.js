import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";
import {
  authHeaders,
  defaultHeaders,
  searchQueries,
  thresholds,
} from "./lib.js";

const searchLatency = new Trend("search_latency", true);
const searchErrors = new Rate("search_errors");

export const options = {
  scenarios: {
    storefront_search: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "2m", target: 50 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    ...thresholds,
    search_latency: ["p(95)<300"],
    search_errors: ["rate<0.02"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const ORG_SLUG = __ENV.ORG_SLUG || "demo";

export default function storefrontSearch() {
  const q = searchQueries[Math.floor(Math.random() * searchQueries.length)];
  const page = Math.floor(Math.random() * 3) + 1;
  const url = `${BASE_URL}/api/v1/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=20`;

  const res = http.get(url, { headers: defaultHeaders(ORG_SLUG) });
  searchLatency.add(res.timings.duration);
  searchErrors.add(res.status >= 400);

  check(res, {
    "search status 200": (r) => r.status === 200,
    "search has items": (r) => {
      try {
        const body = r.json();
        return Array.isArray(body.items);
      } catch {
        return false;
      }
    },
  });

  if (Math.random() < 0.3) {
    const facetsRes = http.get(`${BASE_URL}/api/v1/search/facets?q=${encodeURIComponent(q)}`, {
      headers: defaultHeaders(ORG_SLUG),
    });
    check(facetsRes, { "facets status 200": (r) => r.status === 200 });
  }

  sleep(Math.random() * 1.5 + 0.5);
}

export function setup() {
  const treeRes = http.get(`${BASE_URL}/api/v1/categories/tree`, {
    headers: defaultHeaders(ORG_SLUG),
  });
  check(treeRes, { "category tree warmup": (r) => r.status === 200 });
  return {};
}
