import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'crypto';

export const requestId = () =>
  createMiddleware(async (c, next) => {
    const existing = c.req.header('x-request-id');
    const id = existing ?? randomUUID();
    c.set('requestId', id);
    c.header('X-Request-ID', id);
    await next();
  });
