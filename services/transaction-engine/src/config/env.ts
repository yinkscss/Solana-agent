import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3004),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDPANDA_BROKERS: z.string().default('localhost:9092'),
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  SOLANA_NETWORK: z.enum(['mainnet-beta', 'devnet', 'testnet']).default('devnet'),
  WALLET_ENGINE_URL: z.string().default('http://localhost:3002'),
  POLICY_ENGINE_URL: z.string().default('http://localhost:3003'),
  KORA_URL: z.string().default('http://localhost:8911'),
  MAX_RETRIES: z.coerce.number().default(5),
  CONFIRMATION_TIMEOUT_MS: z.coerce.number().default(60000),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten());
  process.exit(1);
}

export const env: EnvConfig = parsed.data;
