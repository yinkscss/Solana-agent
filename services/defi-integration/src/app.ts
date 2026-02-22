import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import Redis from 'ioredis';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { createAdapterRegistry } from './adapters/adapter-registry';
import { createJupiterAdapter } from './adapters/jupiter.adapter';
import { createRaydiumAdapter } from './adapters/raydium.adapter';
import { createOrcaAdapter } from './adapters/orca.adapter';
import { createMarinadeAdapter } from './adapters/marinade.adapter';
import { createSolendAdapter } from './adapters/solend.adapter';
import { createMetaplexAdapter } from './adapters/metaplex.adapter';
import { createSPLTransferAdapter } from './adapters/spl-transfer.adapter';
import { createPriceFeedService } from './services/price-feed.service';
import { createDeFiService } from './services/defi.service';
import { createDeFiController } from './controllers/defi.controller';
import { createDeFiRoutes } from './routes/defi';

export const createApp = (deps?: { redis?: Redis }) => {
  const redis = deps?.redis ?? new Redis(env.REDIS_URL, { lazyConnect: true });

  const registry = createAdapterRegistry();
  registry.register(createJupiterAdapter(env.JUPITER_API_URL));
  registry.register(createRaydiumAdapter(env.SOLANA_RPC_URL));
  registry.register(createOrcaAdapter(env.SOLANA_RPC_URL));
  registry.register(createMarinadeAdapter(env.SOLANA_RPC_URL));
  registry.register(createSolendAdapter(env.SOLANA_RPC_URL));
  registry.register(createMetaplexAdapter(env.SOLANA_RPC_URL));
  registry.register(createSPLTransferAdapter(env.SOLANA_RPC_URL));

  const priceFeedService = createPriceFeedService(env.PYTH_API_URL, redis);
  const defiService = createDeFiService(registry, priceFeedService, env.TRANSACTION_ENGINE_URL);
  const controller = createDeFiController(defiService);

  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok', service: 'defi-integration' }));

  app.route('/api/v1/defi', createDeFiRoutes(controller));

  app.onError(errorHandler);

  return { app, defiService, redis };
};

export const { app } = createApp();
