export type RateLimitPolicy = {
  bucketName: string;
  maxTokens: number;
  refillRatePerSec: number;
};

export const rateLimitPolicies = {
  login: {
    bucketName: "login",
    maxTokens: 10,
    refillRatePerSec: 10 / 60,
  } satisfies RateLimitPolicy,
  adminWrite: {
    bucketName: "admin-write",
    maxTokens: 60,
    refillRatePerSec: 60 / 60,
  } satisfies RateLimitPolicy,
  heavyAdmin: {
    bucketName: "heavy-admin",
    maxTokens: 10,
    refillRatePerSec: 10 / 60,
  } satisfies RateLimitPolicy,
} as const;

export type RateLimitPolicyKey = keyof typeof rateLimitPolicies;
