import type { MiddlewareHandler } from "hono";
import { httpRequestsTotal, httpRequestDuration, registry } from "./metrics";

let requestIdCounter = 0;

export const metricsMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  const requestId = `${Date.now()}-${++requestIdCounter}`;

  c.header("X-Request-Id", requestId);

  await next();

  const duration = (performance.now() - start) / 1000;
  const method = c.req.method;
  const path = c.req.routePath ?? c.req.path;
  const status = String(c.res.status);

  httpRequestsTotal.inc({ method, path, status });
  httpRequestDuration.observe({ method, path }, duration);
};

export const metricsEndpoint: MiddlewareHandler = async (c) => {
  c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return c.text(registry.collect());
};
