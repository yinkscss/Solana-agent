import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifySignature } from '@solagent/common';

export interface ApiKeyEntry {
  key: string;
  secret: string;
}

export const parseApiKeys = (raw: string): Map<string, ApiKeyEntry> => {
  const store = new Map<string, ApiKeyEntry>();
  if (!raw || raw.trim() === '') return store;

  for (const pair of raw.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      store.set(trimmed, { key: trimmed, secret: '' });
    } else {
      const key = trimmed.slice(0, colonIdx).trim();
      const secret = trimmed.slice(colonIdx + 1).trim();
      if (key) store.set(key, { key, secret });
    }
  }

  return store;
};

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

export const auth = (apiKeys: Map<string, ApiKeyEntry>) =>
  createMiddleware(async (c, next) => {
    if (apiKeys.size === 0) {
      await next();
      return;
    }

    const apiKey = c.req.header('x-api-key');
    if (!apiKey) {
      throw new HTTPException(401, { message: 'Missing X-API-Key header' });
    }

    const entry = apiKeys.get(apiKey);
    if (!entry) {
      throw new HTTPException(401, { message: 'Invalid API key' });
    }

    const signature = c.req.header('x-signature');
    if (signature && entry.secret) {
      const timestamp = c.req.header('x-timestamp');
      if (!timestamp) {
        throw new HTTPException(401, { message: 'Missing X-Timestamp header for signed request' });
      }

      const tsMs = parseInt(timestamp, 10) * 1000;
      if (isNaN(tsMs) || Math.abs(Date.now() - tsMs) > MAX_TIMESTAMP_DRIFT_MS) {
        throw new HTTPException(401, { message: 'Request timestamp expired or invalid' });
      }

      const body = await c.req.text();
      const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature;

      if (!verifySignature(entry.secret, c.req.method, c.req.path, timestamp, body, sig)) {
        throw new HTTPException(401, { message: 'Invalid HMAC signature' });
      }
    }

    c.set('apiKey', apiKey);
    await next();
  });
