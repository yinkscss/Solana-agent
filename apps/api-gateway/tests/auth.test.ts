import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { auth, parseApiKeys, type ApiKeyEntry } from '../src/middleware/auth.js';
import { signRequest } from '@solagent/common';

const TEST_KEY = 'test-key';
const TEST_SECRET = 'test-secret';

const buildApp = (keys?: Map<string, ApiKeyEntry>) => {
  const apiKeys = keys ?? new Map([[TEST_KEY, { key: TEST_KEY, secret: TEST_SECRET }]]);
  const app = new Hono();
  app.use('*', auth(apiKeys));
  app.all('*', (c) => c.json({ ok: true }));
  return app;
};

describe('auth middleware', () => {
  it('allows request with valid API key', async () => {
    const app = buildApp();
    const res = await app.request('/test', {
      headers: { 'X-API-Key': TEST_KEY },
    });
    expect(res.status).toBe(200);
  });

  it('rejects request without API key', async () => {
    const app = buildApp();
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain('Missing');
  });

  it('rejects request with unknown API key', async () => {
    const app = buildApp();
    const res = await app.request('/test', {
      headers: { 'X-API-Key': 'invalid-key' },
    });
    expect(res.status).toBe(401);
  });

  it('validates HMAC signature', async () => {
    const app = buildApp();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"data":"value"}';
    const sig = signRequest(TEST_SECRET, 'POST', '/test', timestamp, body);

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'X-API-Key': TEST_KEY,
        'X-Signature': `sha256=${sig}`,
        'X-Timestamp': timestamp,
        'Content-Type': 'application/json',
      },
      body,
    });
    expect(res.status).toBe(200);
  });

  it('rejects expired timestamp', async () => {
    const app = buildApp();
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const body = '';
    const sig = signRequest(TEST_SECRET, 'GET', '/test', timestamp, body);

    const res = await app.request('/test', {
      headers: {
        'X-API-Key': TEST_KEY,
        'X-Signature': `sha256=${sig}`,
        'X-Timestamp': timestamp,
      },
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain('expired');
  });

  it('rejects invalid HMAC signature', async () => {
    const app = buildApp();
    const timestamp = String(Math.floor(Date.now() / 1000));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'X-API-Key': TEST_KEY,
        'X-Signature': `sha256=${'a'.repeat(64)}`,
        'X-Timestamp': timestamp,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });

  it('rejects signed request without timestamp', async () => {
    const app = buildApp();
    const res = await app.request('/test', {
      headers: {
        'X-API-Key': TEST_KEY,
        'X-Signature': 'sha256=abc',
      },
    });
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toContain('Timestamp');
  });
});

describe('parseApiKeys', () => {
  it('parses comma-separated key:secret pairs', () => {
    const keys = parseApiKeys('key1:secret1,key2:secret2');
    expect(keys.size).toBe(2);
    expect(keys.get('key1')?.secret).toBe('secret1');
    expect(keys.get('key2')?.secret).toBe('secret2');
  });

  it('returns empty map for empty string', () => {
    expect(parseApiKeys('').size).toBe(0);
  });
});
