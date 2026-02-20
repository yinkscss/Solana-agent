import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3006),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDPANDA_BROKERS: z.string().default('localhost:9092'),
  WEBHOOK_RETRY_COUNT: z.coerce.number().default(3),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().default(10000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
