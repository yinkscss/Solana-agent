import { cors as honoCors } from 'hono/cors';

export const corsMiddleware = () =>
  honoCors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Signature',
      'X-Timestamp',
      'X-Request-ID',
    ],
    exposeHeaders: ['X-Request-ID', 'Retry-After'],
    maxAge: 86400,
  });
