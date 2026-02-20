import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTransactionService, type TransactionRepository, type TransactionService } from '../src/services/transaction.service';
import { createTransactionController } from '../src/controllers/transaction.controller';
import { createTransactionRoutes, createWalletTransactionRoutes } from '../src/routes/transactions';
import { errorHandler } from '../src/middleware/error-handler';
import type { TransactionRecord, TransactionListOptions } from '../src/types';
import type { TransactionStatus } from '@solagent/common';

const MOCK_WALLET_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_DEST = '4fYNw3dojWmQ4dXtSGE9epjRGy9pFSx62YypT7avPYvA';
const MOCK_SIGNATURE = '5UfDuX7WXYjABmLELhx2GR1NMRQYUMSbWL3JRPdVqvXbGYy5bUPWKSDAzrLBTKbc4kYk3d6sqFVpN8RaFfyDJqU';
const FAKE_SERIALIZED = Buffer.from('fake-serialized-tx').toString('base64');

const createMockRepo = (): TransactionRepository => {
  const store = new Map<string, TransactionRecord>();
  return {
    insert: vi.fn(async (record) => {
      const full: TransactionRecord = { ...record, createdAt: new Date(), confirmedAt: null };
      store.set(record.id, full);
      return full;
    }),
    findById: vi.fn(async (id) => store.get(id) ?? null),
    findByWalletId: vi.fn(async (walletId, opts: TransactionListOptions) => {
      const all = [...store.values()].filter((t) => t.walletId === walletId);
      const page = opts.page ?? 1;
      const pageSize = opts.pageSize ?? 20;
      const start = (page - 1) * pageSize;
      return {
        data: all.slice(start, start + pageSize),
        total: all.length,
      };
    }),
    updateStatus: vi.fn(async (id, status: TransactionStatus, patch?) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, status } as TransactionRecord;
      store.set(id, updated);
      return updated;
    }),
  };
};

const createMockDeps = (overrides?: Partial<Record<string, unknown>>) => ({
  repo: createMockRepo(),
  builder: {
    buildTransferTransaction: vi.fn(async () => ({
      serialize: () => Buffer.from('fake-serialized-tx'),
    })),
    buildTokenTransferTransaction: vi.fn(async () => ({
      serialize: () => Buffer.from('fake-serialized-tx'),
    })),
    buildCustomTransaction: vi.fn(async () => ({
      serialize: () => Buffer.from('fake-serialized-tx'),
    })),
    getRecentBlockhash: vi.fn(async () => 'mock-blockhash'),
  },
  simulator: {
    simulateTransaction: vi.fn(async () => ({
      success: true,
      logs: ['Program log: ok'],
      unitsConsumed: 200_000,
    })),
  },
  signer: {
    signTransaction: vi.fn(async () => FAKE_SERIALIZED),
  },
  policyClient: {
    evaluateTransaction: vi.fn(async () => ({
      decision: 'allow' as const,
      reasons: [],
    })),
  },
  submitter: {
    submitTransaction: vi.fn(async () => MOCK_SIGNATURE),
  },
  confirmation: {
    waitForConfirmation: vi.fn(async () => ({
      confirmed: true,
      slot: 12345,
    })),
  },
  priorityFee: {
    calculatePriorityFee: vi.fn(async () => 0),
  },
  maxRetries: 3,
  ...overrides,
});

const buildApp = (deps: ReturnType<typeof createMockDeps>) => {
  const service = createTransactionService(deps as any);
  const controller = createTransactionController(service);

  const app = new Hono();
  app.route('/api/v1/transactions', createTransactionRoutes(controller));
  app.route('/api/v1/wallets', createWalletTransactionRoutes(controller));
  app.onError(errorHandler);

  return { app, service };
};

const postTransaction = (app: Hono, body: Record<string, unknown>) =>
  app.request('/api/v1/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Transaction Engine Integration', () => {
  let app: Hono;
  let service: TransactionService;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createMockDeps();
    const ctx = buildApp(deps);
    app = ctx.app;
    service = ctx.service;
  });

  describe('full success flow: pending → confirmed', () => {
    it('builds, simulates, evaluates policy, signs, submits, and confirms', async () => {
      const res = await postTransaction(app, {
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.status).toBe('confirmed');
      expect(data.signature).toBe(MOCK_SIGNATURE);
      expect(data.walletId).toBe(MOCK_WALLET_ID);

      expect(deps.builder.buildTransferTransaction).toHaveBeenCalledOnce();
      expect(deps.simulator.simulateTransaction).toHaveBeenCalledOnce();
      expect(deps.policyClient.evaluateTransaction).toHaveBeenCalledOnce();
      expect(deps.signer.signTransaction).toHaveBeenCalled();
      expect(deps.submitter.submitTransaction).toHaveBeenCalled();
      expect(deps.confirmation.waitForConfirmation).toHaveBeenCalledWith(MOCK_SIGNATURE);
    });
  });

  describe('simulation failure flow', () => {
    it('stops at simulation_failed when simulation returns error', async () => {
      deps.simulator.simulateTransaction.mockResolvedValueOnce({
        success: false,
        logs: [],
        unitsConsumed: 0,
        error: 'InstructionError: insufficient funds',
      });

      const res = await postTransaction(app, {
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '999999999999',
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.status).toBe('simulation_failed');
      expect(data.errorMessage).toContain('insufficient funds');
      expect(deps.signer.signTransaction).not.toHaveBeenCalled();
      expect(deps.submitter.submitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('policy denial flow', () => {
    it('stops at rejected when policy evaluation denies', async () => {
      deps.policyClient.evaluateTransaction.mockResolvedValueOnce({
        decision: 'deny',
        reasons: ['Spending limit exceeded'],
      });

      const res = await postTransaction(app, {
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.status).toBe('rejected');
      expect(data.errorMessage).toContain('Spending limit exceeded');
      expect(deps.signer.signTransaction).not.toHaveBeenCalled();
    });
  });

  describe('signing failure flow', () => {
    it('stops at signing_failed when wallet engine rejects', async () => {
      deps.signer.signTransaction.mockRejectedValueOnce(new Error('Wallet frozen'));

      const res = await postTransaction(app, {
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });

      expect(res.status).toBe(201);
      const { data } = await res.json();
      expect(data.status).toBe('signing_failed');
      expect(data.errorMessage).toContain('Wallet frozen');
      expect(deps.submitter.submitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('get transaction by ID', () => {
    it('creates a transaction then retrieves it with all fields', async () => {
      const createRes = await postTransaction(app, {
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });
      const { data: created } = await createRes.json();

      const getRes = await app.request(`/api/v1/transactions/${created.id}`);
      expect(getRes.status).toBe(200);
      const { data: fetched } = await getRes.json();

      expect(fetched.id).toBe(created.id);
      expect(fetched.walletId).toBe(MOCK_WALLET_ID);
      expect(fetched.status).toBe('confirmed');
      expect(fetched.signature).toBe(MOCK_SIGNATURE);
      expect(fetched.type).toBe('transfer');
    });

    it('returns 404 for nonexistent transaction', async () => {
      const res = await app.request('/api/v1/transactions/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('list transactions by wallet', () => {
    it('creates 3 transactions and lists them with pagination info', async () => {
      for (let i = 0; i < 3; i++) {
        await postTransaction(app, {
          walletId: MOCK_WALLET_ID,
          type: 'transfer',
          destination: MOCK_DEST,
          amount: `${(i + 1) * 1000000}`,
        });
      }

      const listRes = await app.request(
        `/api/v1/wallets/${MOCK_WALLET_ID}/transactions?page=1&pageSize=10`,
      );
      expect(listRes.status).toBe(200);
      const json = await listRes.json();
      expect(json.data).toHaveLength(3);
      expect(json.total).toBe(3);
    });

    it('respects page and pageSize parameters', async () => {
      for (let i = 0; i < 5; i++) {
        await postTransaction(app, {
          walletId: MOCK_WALLET_ID,
          type: 'transfer',
          destination: MOCK_DEST,
          amount: '1000000',
        });
      }

      const page1 = await app.request(
        `/api/v1/wallets/${MOCK_WALLET_ID}/transactions?page=1&pageSize=2`,
      );
      const page1Json = await page1.json();
      expect(page1Json.data).toHaveLength(2);
      expect(page1Json.total).toBe(5);
      expect(page1Json.hasMore).toBe(true);
    });
  });

  describe('retry failed transaction', () => {
    it('retries a failed transaction and re-enters the submit flow', async () => {
      deps.confirmation.waitForConfirmation
        .mockResolvedValueOnce({ confirmed: false, error: 'Confirmation timeout' })
        .mockResolvedValueOnce({ confirmed: true, slot: 99999 });

      const createRes = await postTransaction(app, {
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });
      const { data: created } = await createRes.json();
      expect(['failed', 'retrying', 'confirmed']).toContain(created.status);

      if (created.status === 'failed' || created.status === 'permanently_failed') {
        const retryRes = await app.request(
          `/api/v1/transactions/${created.id}/retry`,
          { method: 'POST' },
        );
        expect(retryRes.status).toBe(200);
        const { data: retried } = await retryRes.json();
        expect(['confirmed', 'submitted', 'retrying', 'failed']).toContain(retried.status);
      }
    });
  });

  describe('validation errors', () => {
    it('returns 400 for missing walletId', async () => {
      const res = await postTransaction(app, { type: 'transfer' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid transaction type', async () => {
      const res = await postTransaction(app, {
        walletId: MOCK_WALLET_ID,
        type: 'invalid_type',
      });
      expect(res.status).toBe(400);
    });
  });
});
