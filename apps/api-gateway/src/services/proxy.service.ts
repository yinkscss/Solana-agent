import type { Env } from '../config/env.js';

export interface ServiceRoute {
  prefix: string;
  target: string;
}

export const buildServiceRoutes = (env: Env): ServiceRoute[] => [
  { prefix: '/api/v1/agents', target: env.AGENT_RUNTIME_URL },
  { prefix: '/api/v1/wallets', target: env.WALLET_ENGINE_URL },
  { prefix: '/api/v1/policies', target: env.POLICY_ENGINE_URL },
  { prefix: '/api/v1/evaluate', target: env.POLICY_ENGINE_URL },
  { prefix: '/api/v1/transactions', target: env.TRANSACTION_ENGINE_URL },
  { prefix: '/api/v1/defi', target: env.DEFI_ENGINE_URL },
  { prefix: '/api/v1/webhooks', target: env.NOTIFICATION_URL },
  { prefix: '/api/v1/alerts', target: env.NOTIFICATION_URL },
  { prefix: '/ws', target: env.NOTIFICATION_URL },
];

const DEFAULT_TIMEOUT_MS = 30_000;

export const proxyRequest = async (
  target: string,
  path: string,
  request: Request,
  requestId: string,
): Promise<Response> => {
  const url = `${target}${path}`;
  const headers = new Headers(request.headers);
  headers.set('X-Request-ID', requestId);
  headers.delete('host');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.body,
      signal: controller.signal,
      // @ts-expect-error -- Bun supports duplex streaming
      duplex: 'half',
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new Response(JSON.stringify({ error: 'Upstream timeout' }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ error: 'Bad Gateway', detail: String(error) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  } finally {
    clearTimeout(timeout);
  }
};

export const resolveTarget = (
  routes: ServiceRoute[],
  path: string,
): ServiceRoute | undefined => {
  return routes.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
};
