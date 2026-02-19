import type { Context } from 'hono';
import { SolAgentError } from '../types';

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof SolAgentError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.statusCode as any,
    );
  }

  console.error('Unhandled error:', err);
  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500,
  );
};
