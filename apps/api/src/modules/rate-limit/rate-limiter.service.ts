import type { RateLimitPolicy } from "./rate-limit.config.js";
import { getRedisClient } from "../../lib/redis.js";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type BucketState = {
  tokens: number;
  lastRefill: number;
};

const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local max_tokens = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local tokens = tonumber(redis.call('HGET', key, 'tokens'))
local last_refill = tonumber(redis.call('HGET', key, 'last_refill'))

if tokens == nil then
  tokens = max_tokens
  last_refill = now
end

local elapsed_sec = (now - last_refill) / 1000
local refilled = tokens + elapsed_sec * refill_rate
local new_tokens = math.min(max_tokens, refilled)

local allowed = 0
local remaining = 0
local reset_at = now
local tokens_after = new_tokens

if new_tokens < 1 then
  allowed = 0
  remaining = 0
  reset_at = now + math.ceil(((1 - new_tokens) / refill_rate) * 1000)
  redis.call('HSET', key, 'tokens', new_tokens, 'last_refill', now)
else
  allowed = 1
  tokens_after = new_tokens - 1
  remaining = math.floor(tokens_after)
  reset_at = now + math.ceil((1 / refill_rate) * 1000)
  redis.call('HSET', key, 'tokens', tokens_after, 'last_refill', now)
end

local ttl_ms = math.ceil((max_tokens / refill_rate) * 1000) + 60000
redis.call('PEXPIRE', key, ttl_ms)

return { allowed, remaining, reset_at }
`;

const memoryBuckets = new Map<string, BucketState>();

function consumeTokenBucket(
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): RateLimitResult {
  const existing = memoryBuckets.get(key);
  let tokens = existing?.tokens ?? policy.maxTokens;
  let lastRefill = existing?.lastRefill ?? now;

  const elapsedSec = (now - lastRefill) / 1000;
  const refilled = tokens + elapsedSec * policy.refillRatePerSec;
  const newTokens = Math.min(policy.maxTokens, refilled);

  if (newTokens < 1) {
    const resetAt = now + Math.ceil(((1 - newTokens) / policy.refillRatePerSec) * 1000);
    memoryBuckets.set(key, { tokens: newTokens, lastRefill: now });
    return { allowed: false, remaining: 0, resetAt };
  }

  const tokensAfter = newTokens - 1;
  memoryBuckets.set(key, { tokens: tokensAfter, lastRefill: now });
  const resetAt = now + Math.ceil((1 / policy.refillRatePerSec) * 1000);
  return {
    allowed: true,
    remaining: Math.floor(tokensAfter),
    resetAt,
  };
}

function parseRedisResult(raw: [number, number, number]): RateLimitResult {
  return {
    allowed: raw[0] === 1,
    remaining: raw[1],
    resetAt: raw[2],
  };
}

async function consumeRedisTokenBucket(
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): Promise<RateLimitResult> {
  const redis = await getRedisClient();
  if (!redis) {
    return consumeTokenBucket(key, policy, now);
  }

  const raw = (await redis.eval(
    TOKEN_BUCKET_LUA,
    1,
    key,
    String(policy.maxTokens),
    String(policy.refillRatePerSec),
    String(now),
  )) as [number, number, number];

  return parseRedisResult(raw);
}

function ipKey(ip: string, policy: RateLimitPolicy): string {
  return `rate:ip:${ip}:${policy.bucketName}`;
}

function userKey(userId: string, policy: RateLimitPolicy): string {
  return `rate:user:${userId}:${policy.bucketName}`;
}

export class RateLimiterService {
  async checkIpLimit(ip: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    return consumeRedisTokenBucket(ipKey(ip, policy), policy);
  }

  async checkUserLimit(userId: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    return consumeRedisTokenBucket(userKey(userId, policy), policy);
  }
}

export const rateLimiterService = new RateLimiterService();

/** Test helper – clears in-memory buckets. */
export function resetRateLimiterStateForTests(): void {
  memoryBuckets.clear();
}

/** Test helper – runs token bucket logic without Redis. */
export function consumeTokenBucketForTests(
  key: string,
  policy: RateLimitPolicy,
  now?: number,
): RateLimitResult {
  return consumeTokenBucket(key, policy, now);
}
