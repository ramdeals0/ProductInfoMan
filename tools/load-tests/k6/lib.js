import http from "k6/http";
import { check } from "k6";

/**
 * Shared k6 helpers for PIM load tests.
 * Usage: k6 run -e BASE_URL=http://localhost:3001 -e ORG_SLUG=demo tools/load-tests/k6/search.js
 */

export function defaultHeaders(orgSlug = __ENV.ORG_SLUG || "demo") {
  return {
    "x-organization-slug": orgSlug,
    "Content-Type": "application/json",
  };
}

export function loginAndGetToken(baseUrl, email, password, orgSlug) {
  const res = http.post(
    `${baseUrl}/api/v1/auth/login`,
    JSON.stringify({ email, password, organizationSlug: orgSlug }),
    { headers: defaultHeaders(orgSlug) },
  );
  check(res, { "login status 200": (r) => r.status === 200 });
  if (res.status !== 200) return null;
  const body = res.json();
  return body.accessToken;
}

export function authHeaders(token, orgSlug = __ENV.ORG_SLUG || "demo") {
  return {
    ...defaultHeaders(orgSlug),
    Authorization: `Bearer ${token}`,
  };
}

export const searchQueries = [
  "shirt",
  "jacket",
  "boot",
  "glove",
  "tool",
  "paint",
  "lamp",
  "hose",
];

export const thresholds = {
  http_req_failed: ["rate<0.02"],
  http_req_duration: ["p(95)<500"],
};
