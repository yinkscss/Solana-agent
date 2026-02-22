import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export const createRateLimiter = (rpm: number) => {
  const buckets = new Map<string, TokenBucket>();
  const refillRate = rpm / 60; // tokens per second

  const getBucket = (key: string): TokenBucket => {
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: rpm, lastRefill: now };
      buckets.set(key, bucket);
      return bucket;
    }

    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(rpm, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;
    return bucket;
  };

  const middleware = createMiddleware(async (c, next) => {
    const key = (c.get('apiKey') as string | undefined) ?? c.req.header('x-api-key') ?? 'anonymous';
    const bucket = getBucket(key);

    if (bucket.tokens < 1) {
      const retryAfter = Math.ceil((1 - bucket.tokens) / refillRate);
      c.header('Retry-After', String(retryAfter));
      throw new HTTPException(429, { message: 'Too Many Requests' });
    }

    bucket.tokens -= 1;
    await next();
  });

  return { middleware, buckets, getBucket };
};
