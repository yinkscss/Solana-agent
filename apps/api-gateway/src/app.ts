import { Hono } from 'hono';
import type { Env } from './config/env.js';
import { requestId } from './middleware/request-id.js';
import { corsMiddleware } from './middleware/cors.js';
import { auth, parseApiKeys } from './middleware/auth.js';
import { createRateLimiter } from './middleware/rate-limiter.js';
import { createProxyRoutes } from './routes/proxy.js';
import { buildServiceRoutes } from './services/proxy.service.js';

export const createApp = (env: Env) => {
  const app = new Hono();

  const apiKeys = parseApiKeys(env.API_KEYS);
  const rateLimiter = createRateLimiter(env.RATE_LIMIT_RPM);
  const serviceRoutes = buildServiceRoutes(env);

  app.use('*', requestId());
  app.use('*', corsMiddleware());

  app.get('/health', (c) => c.json({ status: 'ok', service: 'api-gateway' }));

  app.use('/api/*', auth(apiKeys));
  app.use('/api/*', rateLimiter.middleware);

  app.route('/', createProxyRoutes(serviceRoutes));

  app.notFound((c) => c.json({ error: 'Not Found' }, 404));

  app.onError((err, c) => {
    if ('getResponse' in err && typeof err.getResponse === 'function') {
      return err.getResponse();
    }
    console.error('Unhandled error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
  });

  return app;
};
