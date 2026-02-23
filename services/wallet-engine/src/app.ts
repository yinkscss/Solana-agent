import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { createWalletService } from './services/wallet.service';
import type { WalletRepository } from './services/wallet.service';
import { createBalanceService } from './services/balance.service';
import { createWalletController } from './controllers/wallet.controller';
import { createWalletRoutes, createAgentWalletRoutes } from './routes/wallets';
import { createDrizzleWalletRepo } from './repositories/drizzle-wallet.repository';
import type { WalletRecord } from './types';

const createInMemoryRepo = (): WalletRepository => {
  const store = new Map<string, WalletRecord>();

  return {
    insert: async (record) => {
      const full: WalletRecord = {
        ...record,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(record.id, full);
      return full;
    },
    findById: async (id) => store.get(id) ?? null,
    findByPublicKey: async (publicKey) =>
      [...store.values()].find((w) => w.publicKey === publicKey) ?? null,
    findByAgentId: async (agentId) => [...store.values()].filter((w) => w.agentId === agentId),
    findAll: async (opts) => {
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 50;
      const all = [...store.values()];
      return {
        data: all.slice((page - 1) * pageSize, page * pageSize),
        total: all.length,
      };
    },
    updateStatus: async (id, status) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, status, updatedAt: new Date() };
      store.set(id, updated);
      return updated;
    },
  };
};

export const createApp = (deps?: {
  repo?: WalletRepository;
  redis?: Redis;
  connection?: Connection;
}) => {
  const repo =
    deps?.repo ?? (process.env.DATABASE_URL ? createDrizzleWalletRepo() : createInMemoryRepo());
  const redis = deps?.redis ?? new Redis(env.REDIS_URL, { lazyConnect: true });
  const connection = deps?.connection ?? new Connection(env.SOLANA_RPC_URL, 'confirmed');

  const walletService = createWalletService(repo);
  const balanceService = createBalanceService(walletService, redis, connection);
  const controller = createWalletController(walletService, balanceService);

  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok', service: 'wallet-engine' }));

  app.route('/api/v1/wallets', createWalletRoutes(controller));
  app.route('/api/v1/agents', createAgentWalletRoutes(controller));

  app.onError(errorHandler);

  return { app, walletService, balanceService, redis };
};

export const { app } = createApp();
