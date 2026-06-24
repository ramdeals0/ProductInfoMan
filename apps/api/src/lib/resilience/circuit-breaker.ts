import { loadApiEnv } from "@productinfoman/config";

export type CircuitState = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private failures = 0;
  private state: CircuitState = "closed";
  private openedAt = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold = loadApiEnv().CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    private readonly cooldownMs = loadApiEnv().CIRCUIT_BREAKER_COOLDOWN_MS,
  ) {}

  getState(): CircuitState {
    if (this.state === "open" && Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = "half_open";
    }
    return this.state;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === "open") {
      throw Object.assign(new Error(`Circuit open for ${this.name}`), {
        statusCode: 503,
        code: "CIRCUIT_OPEN",
      });
    }

    try {
      const result = await operation();
      this.failures = 0;
      if (state === "half_open") this.state = "closed";
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.failureThreshold) {
        this.state = "open";
        this.openedAt = Date.now();
      }
      throw error;
    }
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string): CircuitBreaker {
  let breaker = breakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name);
    breakers.set(name, breaker);
  }
  return breaker;
}

export function resetCircuitBreakersForTests(): void {
  breakers.clear();
}
