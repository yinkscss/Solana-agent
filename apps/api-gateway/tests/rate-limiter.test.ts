import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { createRateLimiter } from '../src/middleware/rate-limiter.js';

const buildApp = (rpm: number) => {
  const { middleware, buckets } = createRateLimiter(rpm);
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('apiKey', 'test-key');
    await next();
  });
  app.use('*', middleware);
  app.all('*', (c) => c.json({ ok: true }));
  return { app, buckets };
};

describe('rate limiter', () => {
  it('allows requests under the limit', async () => {
    const { app } = buildApp(10);
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('returns 429 when limit exceeded', async () => {
    const { app } = buildApp(3);

    for (let i = 0; i < 3; i++) {
      const res = await app.request('/test');
      expect(res.status).toBe(200);
    }

    const res = await app.request('/test');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('refills tokens over time', async () => {
    const { app, buckets } = buildApp(5);

    for (let i = 0; i < 5; i++) {
      await app.request('/test');
    }
    const overLimit = await app.request('/test');
    expect(overLimit.status).toBe(429);

    const bucket = buckets.get('test-key')!;
    bucket.lastRefill = Date.now() - 61_000;

    const afterRefill = await app.request('/test');
    expect(afterRefill.status).toBe(200);
  });

  it('tracks different keys independently', async () => {
    const { middleware } = createRateLimiter(2);
    const app = new Hono();

    app.use('/a/*', async (c, next) => {
      c.set('apiKey', 'key-a');
      await next();
    });
    app.use('/b/*', async (c, next) => {
      c.set('apiKey', 'key-b');
      await next();
    });
    app.use('*', middleware);
    app.all('*', (c) => c.json({ ok: true }));

    await app.request('/a/1');
    await app.request('/a/2');
    const aOver = await app.request('/a/3');
    expect(aOver.status).toBe(429);

    const bOk = await app.request('/b/1');
    expect(bOk.status).toBe(200);
  });
});
