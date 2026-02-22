import { describe, it, expect } from 'vitest';
import { resolveTarget, buildServiceRoutes, type ServiceRoute } from '../src/services/proxy.service.js';
import { createApp } from '../src/app.js';
import type { Env } from '../src/config/env.js';

const TEST_ENV: Env = {
  PORT: 8080,
  AGENT_RUNTIME_URL: 'http://agent:3001',
  WALLET_ENGINE_URL: 'http://wallet:3002',
  POLICY_ENGINE_URL: 'http://policy:3003',
  TRANSACTION_ENGINE_URL: 'http://tx:3004',
  DEFI_ENGINE_URL: 'http://defi:3005',
  NOTIFICATION_URL: 'http://notify:3006',
  RATE_LIMIT_RPM: 1000,
  API_KEYS: 'test-key:test-secret',
};

describe('resolveTarget', () => {
  const routes: ServiceRoute[] = [
    { prefix: '/api/v1/agents', target: 'http://agent:3001' },
    { prefix: '/api/v1/wallets', target: 'http://wallet:3002' },
    { prefix: '/api/v1/policies', target: 'http://policy:3003' },
    { prefix: '/api/v1/evaluate', target: 'http://policy:3003' },
    { prefix: '/api/v1/transactions', target: 'http://tx:3004' },
    { prefix: '/api/v1/defi', target: 'http://defi:3005' },
    { prefix: '/api/v1/webhooks', target: 'http://notify:3006' },
    { prefix: '/api/v1/alerts', target: 'http://notify:3006' },
    { prefix: '/ws', target: 'http://notify:3006' },
  ];

  it('matches /api/v1/agents/123 to agent-runtime', () => {
    const match = resolveTarget(routes, '/api/v1/agents/123');
    expect(match?.target).toBe('http://agent:3001');
  });

  it('matches /api/v1/wallets to wallet-engine', () => {
    const match = resolveTarget(routes, '/api/v1/wallets');
    expect(match?.target).toBe('http://wallet:3002');
  });

  it('matches /api/v1/evaluate to policy-engine', () => {
    const match = resolveTarget(routes, '/api/v1/evaluate');
    expect(match?.target).toBe('http://policy:3003');
  });

  it('matches /api/v1/transactions/abc/status to transaction-engine', () => {
    const match = resolveTarget(routes, '/api/v1/transactions/abc/status');
    expect(match?.target).toBe('http://tx:3004');
  });

  it('matches /api/v1/defi/swap to defi-integration', () => {
    const match = resolveTarget(routes, '/api/v1/defi/swap');
    expect(match?.target).toBe('http://defi:3005');
  });

  it('matches /api/v1/webhooks to notification', () => {
    const match = resolveTarget(routes, '/api/v1/webhooks');
    expect(match?.target).toBe('http://notify:3006');
  });

  it('matches /api/v1/alerts to notification', () => {
    const match = resolveTarget(routes, '/api/v1/alerts');
    expect(match?.target).toBe('http://notify:3006');
  });

  it('matches /ws to notification', () => {
    const match = resolveTarget(routes, '/ws');
    expect(match?.target).toBe('http://notify:3006');
  });

  it('returns undefined for unknown paths', () => {
    const match = resolveTarget(routes, '/api/v1/unknown');
    expect(match).toBeUndefined();
  });
});

describe('buildServiceRoutes', () => {
  it('builds all 9 routes from env', () => {
    const routes = buildServiceRoutes(TEST_ENV);
    expect(routes).toHaveLength(9);
  });
});

describe('app integration', () => {
  it('health endpoint bypasses auth', async () => {
    const app = createApp(TEST_ENV);
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('returns 404 for unknown api routes with valid key', async () => {
    const app = createApp(TEST_ENV);
    const res = await app.request('/api/v1/unknown', {
      headers: { 'X-API-Key': 'test-key' },
    });
    expect(res.status).toBe(404);
  });

  it('requires auth for api routes', async () => {
    const app = createApp(TEST_ENV);
    const res = await app.request('/api/v1/agents');
    expect(res.status).toBe(401);
  });

  it('adds X-Request-ID header', async () => {
    const app = createApp(TEST_ENV);
    const res = await app.request('/health');
    expect(res.headers.get('X-Request-ID')).toBeTruthy();
  });

  it('preserves provided X-Request-ID', async () => {
    const app = createApp(TEST_ENV);
    const res = await app.request('/health', {
      headers: { 'X-Request-ID': 'my-custom-id' },
    });
    expect(res.headers.get('X-Request-ID')).toBe('my-custom-id');
  });
});
