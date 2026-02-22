import { Hono } from 'hono';
import type { ServiceRoute } from '../services/proxy.service.js';
import { proxyRequest, resolveTarget } from '../services/proxy.service.js';

export const createProxyRoutes = (routes: ServiceRoute[]) => {
  const app = new Hono();

  app.all('/api/v1/*', async (c) => {
    const match = resolveTarget(routes, c.req.path);
    if (!match) {
      return c.json({ error: 'Not Found', path: c.req.path }, 404);
    }

    const requestId = c.get('requestId') as string ?? c.req.header('x-request-id') ?? 'unknown';
    return proxyRequest(match.target, c.req.path, c.req.raw, requestId);
  });

  app.all('/ws', async (c) => {
    const match = resolveTarget(routes, '/ws');
    if (!match) {
      return c.json({ error: 'WebSocket route not configured' }, 404);
    }

    const requestId = c.get('requestId') as string ?? c.req.header('x-request-id') ?? 'unknown';
    return proxyRequest(match.target, c.req.path, c.req.raw, requestId);
  });

  return app;
};
