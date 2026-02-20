import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  createTransactionService,
  type TransactionRepository,
} from '../../services/transaction-engine/src/services/transaction.service';
import { createTransactionController } from '../../services/transaction-engine/src/controllers/transaction.controller';
import { createTransactionRoutes } from '../../services/transaction-engine/src/routes/transactions';
import { errorHandler } from '../../services/transaction-engine/src/middleware/error-handler';
import type { TransactionRecord } from '../../services/transaction-engine/src/types';

const WALLET_UUID = '550e8400-e29b-41d4-a716-446655440000';
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
    findByWalletId: vi.fn(async () => ({ data: [], total: 0 })),
    updateStatus: vi.fn(async (id, status: string, patch?) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, status } as TransactionRecord;
      store.set(id, updated);
      return updated;
    }),
  };
};

const createMockDeps = () => ({
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
    buildVersionedTransferTransaction: vi.fn(async () => ({
      serialize: () => new Uint8Array([1, 2, 3]),
    })),
    buildVersionedCustomTransaction: vi.fn(async () => ({
      serialize: () => new Uint8Array([1, 2, 3]),
    })),
    fetchAddressLookupTable: vi.fn(async () => null),
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
});

const buildApp = (deps: ReturnType<typeof createMockDeps>) => {
  const service = createTransactionService(deps as any);
  const controller = createTransactionController(service);
  const app = new Hono();
  app.route('/api/v1/transactions', createTransactionRoutes(controller));
  app.onError(errorHandler);
  return app;
};

const postTransaction = (app: Hono, overrides: Record<string, unknown> = {}) =>
  app.request('/api/v1/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletId: WALLET_UUID,
      type: 'transfer',
      destination: MOCK_DEST,
      amount: '1000000',
      ...overrides,
    }),
  });

describe('Transaction Flow E2E', () => {
  it('returns simulation_failed when simulation errors', async () => {
    const deps = createMockDeps();
    deps.simulator.simulateTransaction.mockResolvedValueOnce({
      success: false,
      logs: [],
      unitsConsumed: 0,
      error: 'InstructionError: insufficient funds',
    });
    const app = buildApp(deps);

    const res = await postTransaction(app);
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.status).toBe('simulation_failed');
    expect(data.errorMessage).toContain('insufficient funds');
    expect(deps.signer.signTransaction).not.toHaveBeenCalled();
  });

  it('retries failed transaction and eventually succeeds', async () => {
    const deps = createMockDeps();
    deps.confirmation.waitForConfirmation
      .mockResolvedValueOnce({ confirmed: false, error: 'Timeout' })
      .mockResolvedValueOnce({ confirmed: true, slot: 99999 });
    const app = buildApp(deps);

    const res = await postTransaction(app);
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.status).toBe('confirmed');
    expect(data.retryCount).toBe(1);
    expect(deps.submitter.submitTransaction).toHaveBeenCalledTimes(2);
    expect(deps.confirmation.waitForConfirmation).toHaveBeenCalledTimes(2);
  });

  it('processes a transfer through the full lifecycle', async () => {
    const deps = createMockDeps();
    const app = buildApp(deps);

    const res = await postTransaction(app);
    expect(res.status).toBe(201);
    const { data } = await res.json();

    expect(data.status).toBe('confirmed');
    expect(data.signature).toBe(MOCK_SIGNATURE);
    expect(data.walletId).toBe(WALLET_UUID);
    expect(data.type).toBe('transfer');

    expect(deps.simulator.simulateTransaction).toHaveBeenCalledOnce();
    expect(deps.policyClient.evaluateTransaction).toHaveBeenCalledOnce();
    expect(deps.signer.signTransaction).toHaveBeenCalled();
    expect(deps.submitter.submitTransaction).toHaveBeenCalled();
    expect(deps.confirmation.waitForConfirmation).toHaveBeenCalledWith(MOCK_SIGNATURE);
  });
});
