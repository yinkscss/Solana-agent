import { Hono } from 'hono';
import type { Env } from '../config/env.js';

const HEALTH_TIMEOUT_MS = 5_000;
const FETCH_TIMEOUT_MS = 10_000;

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  latency: number | null;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function toArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'data' in data) {
    const inner = (data as Record<string, unknown>).data;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

async function checkServiceHealth(name: string, baseUrl: string): Promise<ServiceHealth> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    await fetch(`${baseUrl}/health`, { signal: controller.signal });
    return { name, status: 'healthy', latency: Date.now() - start };
  } catch {
    return { name, status: 'unhealthy', latency: null };
  } finally {
    clearTimeout(timeout);
  }
}

export const createDashboardRoutes = (env: Env) => {
  const app = new Hono();

  app.get('/api/v1/dashboard/stats', async (c) => {
    const [agentsRaw, walletsRaw, txRaw] = await Promise.all([
      fetchJson(`${env.AGENT_RUNTIME_URL}/api/v1/agents`).catch(() => null),
      fetchJson(`${env.WALLET_ENGINE_URL}/api/v1/wallets`).catch(() => null),
      fetchJson(`${env.TRANSACTION_ENGINE_URL}/api/v1/transactions`).catch(() => null),
    ]);

    const agents = toArray(agentsRaw);
    const wallets = toArray(walletsRaw);
    const transactions = toArray(txRaw);

    const totalAgents = agents.length;
    const runningAgents = agents.filter(
      (a) => (a as Record<string, unknown>).status === 'running',
    ).length;
    const totalWallets = wallets.length;

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentTx = transactions.filter((t) => {
      const rec = t as Record<string, unknown>;
      const raw = rec.createdAt ?? rec.created_at ?? rec.timestamp;
      return raw ? new Date(raw as string).getTime() >= oneDayAgo : false;
    });

    const totalTransactions24h = recentTx.length;
    const failedTransactions24h = recentTx.filter(
      (t) => (t as Record<string, unknown>).status === 'failed',
    ).length;
    const successRate =
      totalTransactions24h > 0
        ? Math.round(((totalTransactions24h - failedTransactions24h) / totalTransactions24h) * 100)
        : 100;

    return c.json({
      totalAgents,
      runningAgents,
      totalWallets,
      totalTransactions24h,
      failedTransactions24h,
      successRate,
    });
  });

  app.get('/api/v1/health/services', async (c) => {
    const results = await Promise.all([
      checkServiceHealth('Agent Runtime', env.AGENT_RUNTIME_URL),
      checkServiceHealth('Wallet Engine', env.WALLET_ENGINE_URL),
      checkServiceHealth('Transaction Engine', env.TRANSACTION_ENGINE_URL),
      checkServiceHealth('Policy Engine', env.POLICY_ENGINE_URL),
      checkServiceHealth('DeFi Integration', env.DEFI_ENGINE_URL),
    ]);
    return c.json(results);
  });

  return app;
};
