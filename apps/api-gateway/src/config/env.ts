import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  AGENT_RUNTIME_URL: z.string().default('http://localhost:3001'),
  WALLET_ENGINE_URL: z.string().default('http://localhost:3002'),
  POLICY_ENGINE_URL: z.string().default('http://localhost:3003'),
  TRANSACTION_ENGINE_URL: z.string().default('http://localhost:3004'),
  DEFI_ENGINE_URL: z.string().default('http://localhost:3005'),
  NOTIFICATION_URL: z.string().default('http://localhost:3006'),
  RATE_LIMIT_RPM: z.coerce.number().default(100),
  API_KEYS: z.string().default('demo-key-123'),
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (): Env => envSchema.parse(process.env);
