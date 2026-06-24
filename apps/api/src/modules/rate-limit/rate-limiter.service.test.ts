import { afterEach, describe, expect, it } from "vitest";
import { rateLimitPolicies } from "./rate-limit.config.js";
import {
  consumeTokenBucketForTests,
  rateLimiterService,
  resetRateLimiterStateForTests,
} from "./rate-limiter.service.js";

describe("RateLimiterService token bucket", () => {
  afterEach(() => {
    resetRateLimiterStateForTests();
  });

  it("allows the first request and decrements remaining tokens", async () => {
    const policy = rateLimitPolicies.login;
    const result = await rateLimiterService.checkIpLimit("203.0.113.1", policy);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(policy.maxTokens - 1);
    expect(result.resetAt).toBeGreaterThan(Date.now() - 5);
  });

  it("rejects requests after the bucket is exhausted", () => {
    const policy = {
      bucketName: "test",
      maxTokens: 2,
      refillRatePerSec: 0,
    };
    const key = "rate:test:exhaust";

    const first = consumeTokenBucketForTests(key, policy, 1_000);
    const second = consumeTokenBucketForTests(key, policy, 1_000);
    const third = consumeTokenBucketForTests(key, policy, 1_000);

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("refills tokens after elapsed time", () => {
    const policy = {
      bucketName: "test-refill",
      maxTokens: 2,
      refillRatePerSec: 1,
    };
    const key = "rate:test:refill";

    consumeTokenBucketForTests(key, policy, 0);
    consumeTokenBucketForTests(key, policy, 0);
    const blocked = consumeTokenBucketForTests(key, policy, 0);
    expect(blocked.allowed).toBe(false);

    const afterOneSecond = consumeTokenBucketForTests(key, policy, 1_100);
    expect(afterOneSecond.allowed).toBe(true);
    expect(afterOneSecond.remaining).toBe(0);
  });

  it("tracks per-user buckets independently", async () => {
    const policy = rateLimitPolicies.adminWrite;

    const userA = await rateLimiterService.checkUserLimit("user-a", policy);
    const userB = await rateLimiterService.checkUserLimit("user-b", policy);

    expect(userA.allowed).toBe(true);
    expect(userB.allowed).toBe(true);
    expect(userA.remaining).toBe(policy.maxTokens - 1);
    expect(userB.remaining).toBe(policy.maxTokens - 1);
  });
});
