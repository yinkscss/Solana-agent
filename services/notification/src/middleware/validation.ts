import type { Context, Next } from 'hono';
import type { z } from 'zod';

export const validateBody =
  <T extends z.ZodType>(schema: T) =>
  async (c: Context, next: Next) => {
    const raw = await c.req.json();
    const result = schema.safeParse(raw);

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: { issues: result.error.errors },
          },
        },
        400,
      );
    }

    c.set('validatedBody', result.data);
    return next();
  };

export const validateParams =
  <T extends z.ZodType>(schema: T) =>
  async (c: Context, next: Next) => {
    const result = schema.safeParse(c.req.param());

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid path parameters',
            details: { issues: result.error.errors },
          },
        },
        400,
      );
    }

    c.set('validatedParams', result.data);
    return next();
  };
