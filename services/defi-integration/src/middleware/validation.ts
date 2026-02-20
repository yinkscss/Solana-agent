import type { Context, Next } from 'hono';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../types';

export const validateBody =
  (schema: ZodSchema) =>
  async (c: Context, next: Next) => {
    const body = await c.req.json().catch(() => null);
    if (!body) throw new ValidationError('Request body is required');

    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ValidationError('Invalid request body', result.error.flatten() as unknown as Record<string, unknown>);
    }

    c.set('validatedBody', result.data);
    await next();
  };

export const validateQuery =
  (schema: ZodSchema) =>
  async (c: Context, next: Next) => {
    const result = schema.safeParse(c.req.query());
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.flatten() as unknown as Record<string, unknown>);
    }

    c.set('validatedQuery', result.data);
    await next();
  };
