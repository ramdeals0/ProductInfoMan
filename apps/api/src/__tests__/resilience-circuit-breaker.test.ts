import { describe, expect, it, beforeEach } from "vitest";
import { CircuitBreaker, getCircuitBreaker, resetCircuitBreakersForTests } from "../lib/resilience/circuit-breaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    resetCircuitBreakersForTests();
  });

  it("passes through successful operations", async () => {
    const breaker = new CircuitBreaker("test", 3, 1000);
    const result = await breaker.execute(async () => "ok");
    expect(result).toBe("ok");
  });

  it("opens after repeated failures", async () => {
    const breaker = new CircuitBreaker("test", 2, 60_000);
    const fail = () => breaker.execute(async () => {
      throw new Error("boom");
    });

    await expect(fail()).rejects.toThrow("boom");
    await expect(fail()).rejects.toThrow("boom");

    await expect(fail()).rejects.toMatchObject({
      message: expect.stringContaining("Circuit open"),
      code: "CIRCUIT_OPEN",
    });
  });

  it("shares breakers by name via getCircuitBreaker", () => {
    const a = getCircuitBreaker("opensearch");
    const b = getCircuitBreaker("opensearch");
    expect(a).toBe(b);
  });
});
