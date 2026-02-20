import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3005),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  TRANSACTION_ENGINE_URL: z.string().default('http://localhost:3004'),
  JUPITER_API_URL: z.string().default('https://quote-api.jup.ag/v6'),
  PYTH_API_URL: z.string().default('https://hermes.pyth.network/v2'),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten());
  process.exit(1);
}

export const env: EnvConfig = parsed.data;
