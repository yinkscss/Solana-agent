import { Hono } from 'hono';
import type { Env } from '../config/env.js';
import { proxyRequest } from '../services/proxy.service.js';

const getRequestId = (c: {
  get: (k: string) => unknown;
  req: { header: (k: string) => string | undefined };
}): string => (c.get('requestId') as string) ?? c.req.header('x-request-id') ?? 'unknown';

const proxyTo = (target: string) => {
  return async (c: {
    get: (k: string) => unknown;
    req: { url: string; raw: Request; header: (k: string) => string | undefined };
  }) => {
    const url = new URL(c.req.url);
    const pathAndQuery = url.pathname + url.search;
    return proxyRequest(target, pathAndQuery, c.req.raw, getRequestId(c));
  };
};

export const createProxyRoutes = (env: Env) => {
  const app = new Hono();

  // Cross-service routes must be registered before their prefix catch-alls
  const walletProxy = proxyTo(env.WALLET_ENGINE_URL);
  app.all('/api/v1/agents/:agentId/wallets', walletProxy);
  app.all('/api/v1/agents/:agentId/wallets/*', walletProxy);

  const txProxy = proxyTo(env.TRANSACTION_ENGINE_URL);
  app.all('/api/v1/wallets/:walletId/transactions', txProxy);
  app.all('/api/v1/wallets/:walletId/transactions/*', txProxy);

  // Standard prefix routes
  app.all('/api/v1/agents', proxyTo(env.AGENT_RUNTIME_URL));
  app.all('/api/v1/agents/*', proxyTo(env.AGENT_RUNTIME_URL));
  app.all('/api/v1/orgs/:orgId/agents/*', proxyTo(env.AGENT_RUNTIME_URL));
  app.all('/api/v1/wallets', proxyTo(env.WALLET_ENGINE_URL));
  app.all('/api/v1/wallets/*', proxyTo(env.WALLET_ENGINE_URL));
  app.all('/api/v1/transactions', proxyTo(env.TRANSACTION_ENGINE_URL));
  app.all('/api/v1/transactions/*', proxyTo(env.TRANSACTION_ENGINE_URL));
  app.all('/api/v1/policies', proxyTo(env.POLICY_ENGINE_URL));
  app.all('/api/v1/policies/*', proxyTo(env.POLICY_ENGINE_URL));
  app.all('/api/v1/evaluate/*', proxyTo(env.POLICY_ENGINE_URL));
  app.all('/api/v1/defi/*', proxyTo(env.DEFI_ENGINE_URL));
  app.all('/api/v1/webhooks/*', proxyTo(env.NOTIFICATION_URL));
  app.all('/api/v1/alerts/*', proxyTo(env.NOTIFICATION_URL));
  app.all('/ws', proxyTo(env.NOTIFICATION_URL));

  return app;
};
