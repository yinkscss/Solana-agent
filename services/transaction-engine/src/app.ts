import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Connection } from '@solana/web3.js';
import Redis from 'ioredis';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { createBuilderService } from './services/builder.service';
import { createSimulatorService } from './services/simulator.service';
import { createSignerService } from './services/signer.service';
import { createPolicyClientService } from './services/policy-client.service';
import { createSubmitterService } from './services/submitter.service';
import { createConfirmationService } from './services/confirmation.service';
import { createPriorityFeeService } from './services/priority-fee.service';
import { createWalletResolverService } from './services/wallet-resolver.service';
import type { WalletResolverService } from './services/wallet-resolver.service';
import { createTransactionService } from './services/transaction.service';
import type { TransactionRepository } from './services/transaction.service';
import { createTransactionController } from './controllers/transaction.controller';
import { createTransactionRoutes, createWalletTransactionRoutes } from './routes/transactions';
import { createDrizzleTransactionRepo } from './repositories/drizzle-transaction.repository';
import type { TransactionRecord, TransactionListOptions } from './types';
import type { TransactionStatus } from '@solagent/common';

const createInMemoryRepo = (): TransactionRepository => {
  const store = new Map<string, TransactionRecord>();

  return {
    insert: async (record) => {
      const full: TransactionRecord = {
        ...record,
        createdAt: new Date(),
        confirmedAt: null,
      };
      store.set(record.id, full);
      return full;
    },
    findById: async (id) => store.get(id) ?? null,
    findByWalletId: async (walletId, opts: TransactionListOptions) => {
      const all = [...store.values()].filter((t) => t.walletId === walletId);
      const filtered = all.filter((t) => {
        if (opts.status && t.status !== opts.status) return false;
        if (opts.type && t.type !== opts.type) return false;
        return true;
      });
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 20;
      const start = (page - 1) * pageSize;
      return {
        data: filtered.slice(start, start + pageSize),
        total: filtered.length,
      };
    },
    updateStatus: async (id, status: TransactionStatus, patch?) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, status, updatedAt: new Date() } as TransactionRecord;
      store.set(id, updated);
      return updated;
    },
  };
};

export const createApp = (deps?: {
  repo?: TransactionRepository;
  redis?: Redis;
  connection?: Connection;
  walletResolver?: WalletResolverService;
}) => {
  const repo =
    deps?.repo ??
    (process.env.DATABASE_URL ? createDrizzleTransactionRepo() : createInMemoryRepo());
  const redis = deps?.redis ?? new Redis(env.REDIS_URL, { lazyConnect: true });
  const connection = deps?.connection ?? new Connection(env.SOLANA_RPC_URL, 'confirmed');

  const builderService = createBuilderService(connection, redis);
  const simulatorService = createSimulatorService(connection);
  const signerService = createSignerService(env.WALLET_ENGINE_URL);
  const policyClientService = createPolicyClientService(env.POLICY_ENGINE_URL);
  const submitterService = createSubmitterService(connection, env.KORA_URL, env.MAX_RETRIES);
  const confirmationService = createConfirmationService(connection, env.CONFIRMATION_TIMEOUT_MS);
  const priorityFeeService = createPriorityFeeService(connection, redis);
  const walletResolverService =
    deps?.walletResolver ?? createWalletResolverService(env.WALLET_ENGINE_URL);

  const transactionService = createTransactionService({
    repo,
    builder: builderService,
    simulator: simulatorService,
    signer: signerService,
    policyClient: policyClientService,
    submitter: submitterService,
    confirmation: confirmationService,
    priorityFee: priorityFeeService,
    walletResolver: walletResolverService,
    maxRetries: env.MAX_RETRIES,
  });

  const controller = createTransactionController(transactionService);

  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok', service: 'transaction-engine' }));

  app.route('/api/v1/transactions', createTransactionRoutes(controller));
  app.route('/api/v1/wallets', createWalletTransactionRoutes(controller));

  app.onError(errorHandler);

  return { app, transactionService, redis };
};

export const { app } = createApp();
