import type { Context, Next } from 'hono';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../types';

export const validateBody =
  (schema: ZodSchema) => async (c: Context, next: Next) => {
    const body = await c.req.json().catch(() => null);
    if (!body) throw new ValidationError('Request body is required');

    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ValidationError('Invalid request body', result.error.flatten());
    }

    c.set('validatedBody', result.data);
    await next();
  };

export const validateParams =
  (schema: ZodSchema) => async (c: Context, next: Next) => {
    const result = schema.safeParse(c.req.param());
    if (!result.success) {
      throw new ValidationError('Invalid path parameters', result.error.flatten());
    }

    c.set('validatedParams', result.data);
    await next();
  };
