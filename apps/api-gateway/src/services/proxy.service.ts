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
    return new Response(JSON.stringify({ error: 'Bad Gateway', detail: String(error) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(timeout);
  }
};
