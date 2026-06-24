import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertHeavyJobCapacity } from "../lib/queue-backpressure.js";

vi.mock("../lib/redis.js", () => ({
  getRedisClient: vi.fn(),
}));

vi.mock("@productinfoman/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@productinfoman/config")>();
  return {
    ...actual,
    loadApiEnv: () => ({
      ...actual.loadApiEnv(),
      HEAVY_JOB_QUEUE_THRESHOLD: 5,
    }),
  };
});

import { getRedisClient } from "../lib/redis.js";

describe("assertHeavyJobCapacity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REDIS_URL = "redis://localhost:6379";
  });

  it("allows jobs when queue depth is below threshold", async () => {
    vi.mocked(getRedisClient).mockResolvedValue({
      llen: vi.fn().mockResolvedValue(1),
      zcard: vi.fn().mockResolvedValue(0),
    } as never);

    await expect(assertHeavyJobCapacity("import-jobs")).resolves.toBeUndefined();
  });

  it("returns 429 BACKPRESSURE when queue is at capacity", async () => {
    vi.mocked(getRedisClient).mockResolvedValue({
      llen: vi.fn().mockResolvedValue(10),
      zcard: vi.fn().mockResolvedValue(0),
    } as never);

    await expect(assertHeavyJobCapacity("import-jobs")).rejects.toMatchObject({
      statusCode: 429,
      code: "BACKPRESSURE",
    });
  });
});
