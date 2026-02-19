import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3002),
  DATABASE_URL: z.string().default('postgresql://localhost:5432/solagent'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  SOLANA_NETWORK: z
    .enum(['mainnet-beta', 'devnet', 'testnet'])
    .default('devnet'),
  TURNKEY_API_KEY: z.string().optional(),
  TURNKEY_ORGANIZATION_ID: z.string().optional(),
  TURNKEY_PRIVATE_KEY: z.string().optional(),
  DEFAULT_KEY_PROVIDER: z
    .enum(['local', 'turnkey', 'crossmint', 'privy'])
    .default('local'),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten());
  process.exit(1);
}

export const env: EnvConfig = parsed.data;
