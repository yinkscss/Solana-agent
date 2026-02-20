import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof ZodError) {
    return c.json<ErrorBody>(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: { issues: err.errors } } },
      400,
    );
  }

  if ('statusCode' in err && typeof (err as Record<string, unknown>).statusCode === 'number') {
    const typed = err as Error & { statusCode: number; code: string; details?: Record<string, unknown> };
    const status = (typed.statusCode >= 200 && typed.statusCode < 600
      ? typed.statusCode
      : 500) as ContentfulStatusCode;
    return c.json<ErrorBody>(
      { success: false, error: { code: typed.code ?? 'ERROR', message: typed.message, details: typed.details } },
      status,
    );
  }

  console.error('Unhandled error:', err);
  return c.json<ErrorBody>(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
    500,
  );
};
