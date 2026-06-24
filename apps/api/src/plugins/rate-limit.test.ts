import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { rateLimitPolicies } from "../modules/rate-limit/rate-limit.config.js";
import { resetRateLimiterStateForTests } from "../modules/rate-limit/rate-limiter.service.js";
import {
  RateLimit,
  registerRateLimitHook,
  resolveRateLimitForRequest,
} from "../plugins/rate-limit.js";

describe("rate limit guard", () => {
  afterEach(() => {
    resetRateLimiterStateForTests();
  });

  it("resolves login policy for POST /api/v1/auth/login", () => {
    const request = {
      method: "POST",
      url: "/api/v1/auth/login",
      routeOptions: { config: RateLimit("login", "ip").rateLimit },
    } as Parameters<typeof resolveRateLimitForRequest>[0];

    const resolved = resolveRateLimitForRequest(request);
    expect(resolved?.policy.bucketName).toBe("login");
    expect(resolved?.by).toBe("ip");
  });

  it("resolves heavy admin policy for import uploads", () => {
    const request = {
      method: "POST",
      url: "/api/v1/imports/upload",
      routeOptions: { config: {} },
    } as Parameters<typeof resolveRateLimitForRequest>[0];

    const resolved = resolveRateLimitForRequest(request);
    expect(resolved?.policy.bucketName).toBe("heavy-admin");
    expect(resolved?.by).toBe("user");
  });

  it("returns 429 when login rate limit is exceeded", async () => {
    const app = Fastify({ trustProxy: true });
    registerRateLimitHook(app);

    app.post(
      "/api/v1/auth/login",
      { config: RateLimit("login", "ip") },
      async () => ({ ok: true }),
    );

    await app.ready();

    const policy = rateLimitPolicies.login;
    let lastStatus = 200;

    for (let attempt = 0; attempt < policy.maxTokens + 1; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.50",
      });
      lastStatus = response.statusCode;
    }

    expect(lastStatus).toBe(429);
    const body = JSON.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          remoteAddress: "203.0.113.50",
        })
      ).body,
    ) as { code: string; bucket: string };

    expect(body.code).toBe("RATE_LIMITED");
    expect(body.bucket).toBe("login");

    await app.close();
  });

  it("returns 429 for authenticated admin write bursts", async () => {
    const app = Fastify();

    await app.register(async (routes) => {
      routes.addHook("preHandler", async (request) => {
        request.authUser = {
          sub: "editor-1",
          email: "editor@demo.local",
          organizationId: "org-1",
          organizationSlug: "demo",
          roles: ["product_editor"],
        };
      });
      routes.post("/api/v1/products", async (request) => ({
        userId: request.authUser?.sub,
      }));
    });

    registerRateLimitHook(app);
    await app.ready();

    const policy = rateLimitPolicies.adminWrite;
    let blocked = false;

    for (let attempt = 0; attempt < policy.maxTokens + 1; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/products",
      });
      if (response.statusCode === 429) {
        blocked = true;
        expect(response.headers["retry-after"]).toBeDefined();
        expect(response.headers["x-ratelimit-limit"]).toBe(String(policy.maxTokens));
        break;
      }
    }

    expect(blocked).toBe(true);
    await app.close();
  });

  it("allows requests within configured limits", async () => {
    const app = Fastify();

    await app.register(async (routes) => {
      routes.addHook("preHandler", async (request) => {
        request.authUser = {
          sub: "editor-2",
          email: "editor2@demo.local",
          organizationId: "org-1",
          organizationSlug: "demo",
          roles: ["product_editor"],
        };
      });
      routes.post("/api/v1/products", async () => ({ ok: true }));
    });

    registerRateLimitHook(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/products",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
    await app.close();
  });
});
