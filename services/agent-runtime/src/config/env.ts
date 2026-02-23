import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDPANDA_BROKERS: z.string().default('localhost:9092'),
  WALLET_ENGINE_URL: z.string().default('http://localhost:3002'),
  POLICY_ENGINE_URL: z.string().default('http://localhost:3003'),
  TRANSACTION_ENGINE_URL: z.string().default('http://localhost:3004'),
  DEFI_ENGINE_URL: z.string().default('http://localhost:3005'),
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEFAULT_LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  DEFAULT_MODEL: z.string().default('gpt-4o'),
  MAX_TOOL_ITERATIONS: z.coerce.number().default(10),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten());
  process.exit(1);
}

export const env: EnvConfig = parsed.data;
