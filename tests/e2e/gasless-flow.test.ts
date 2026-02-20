import { describe, it, expect, vi } from 'vitest';
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
const MOCK_SIGNATURE = 'KoraRelaySig1111111111111111111111111111111111111111111111111111111111111111111111111111';
const FAKE_SERIALIZED = Buffer.from('fake-gasless-tx').toString('base64');

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

describe('Gasless Transaction Flow E2E', () => {
  it('submits gasless transaction via Kora relay', async () => {
    const submitterMock = vi.fn(async () => MOCK_SIGNATURE);

    const deps = {
      repo: createMockRepo(),
      builder: {
        buildTransferTransaction: vi.fn(async () => ({
          serialize: () => Buffer.from('fake-gasless-tx'),
        })),
        buildTokenTransferTransaction: vi.fn(async () => ({
          serialize: () => Buffer.from('fake-gasless-tx'),
        })),
        buildCustomTransaction: vi.fn(async () => ({
          serialize: () => Buffer.from('fake-gasless-tx'),
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
          logs: ['Program log: gasless ok'],
          unitsConsumed: 150_000,
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
        submitTransaction: submitterMock,
      },
      confirmation: {
        waitForConfirmation: vi.fn(async () => ({
          confirmed: true,
          slot: 77777,
        })),
      },
      priorityFee: {
        calculatePriorityFee: vi.fn(async () => 0),
      },
      maxRetries: 3,
    };

    const service = createTransactionService(deps as any);
    const controller = createTransactionController(service);
    const app = new Hono();
    app.route('/api/v1/transactions', createTransactionRoutes(controller));
    app.onError(errorHandler);

    const res = await app.request('/api/v1/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletId: WALLET_UUID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '500000',
        gasless: true,
      }),
    });

    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.status).toBe('confirmed');
    expect(data.gasless).toBe(true);

    expect(submitterMock).toHaveBeenCalledOnce();
    const [, submitOpts] = submitterMock.mock.calls[0];
    expect(submitOpts).toEqual({ gasless: true });
  });
});
