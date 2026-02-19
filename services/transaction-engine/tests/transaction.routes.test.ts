import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTransactionRoutes, createWalletTransactionRoutes } from '../src/routes/transactions';
import { createTransactionController } from '../src/controllers/transaction.controller';
import type { TransactionService } from '../src/services/transaction.service';
import type { TransactionRecord } from '../src/types';
import { errorHandler } from '../src/middleware/error-handler';

const MOCK_TX_ID = '00000000-0000-0000-0000-000000000099';
const MOCK_WALLET_ID = '00000000-0000-0000-0000-000000000001';

const mockRecord: TransactionRecord = {
  id: MOCK_TX_ID,
  walletId: MOCK_WALLET_ID,
  agentId: null,
  signature: null,
  type: 'transfer',
  status: 'confirmed',
  instructions: [],
  feeLamports: null,
  gasless: false,
  metadata: {},
  errorMessage: null,
  retryCount: 0,
  createdAt: new Date(),
  confirmedAt: new Date(),
};

const createMockService = (): TransactionService => ({
  createAndExecuteTransaction: vi.fn(async () => mockRecord),
  getTransaction: vi.fn(async () => mockRecord),
  getTransactionsByWallet: vi.fn(async () => ({
    data: [mockRecord],
    total: 1,
  })),
  retryTransaction: vi.fn(async () => mockRecord),
});

describe('Transaction Routes', () => {
  let app: Hono;
  let mockService: TransactionService;

  beforeEach(() => {
    mockService = createMockService();
    const controller = createTransactionController(mockService);
    app = new Hono();
    app.route('/api/v1/transactions', createTransactionRoutes(controller));
    app.route('/api/v1/wallets', createWalletTransactionRoutes(controller));
    app.onError(errorHandler);
  });

  describe('POST /api/v1/transactions', () => {
    it('creates a transaction and returns 201', async () => {
      const res = await app.request('/api/v1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: MOCK_WALLET_ID,
          type: 'transfer',
          destination: '4fYNw3dojWmQ4dXtSGE9epjRGy9pFSx62YypT7avPYvA',
          amount: '1000000',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.id).toBe(MOCK_TX_ID);
    });

    it('returns 400 for missing walletId', async () => {
      const res = await app.request('/api/v1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'transfer' }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid type', async () => {
      const res = await app.request('/api/v1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: MOCK_WALLET_ID,
          type: 'invalid_type',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/transactions/:txId', () => {
    it('returns a transaction', async () => {
      const res = await app.request(`/api/v1/transactions/${MOCK_TX_ID}`);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(MOCK_TX_ID);
    });
  });

  describe('POST /api/v1/transactions/:txId/retry', () => {
    it('retries a transaction', async () => {
      const res = await app.request(`/api/v1/transactions/${MOCK_TX_ID}/retry`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(MOCK_TX_ID);
      expect(mockService.retryTransaction).toHaveBeenCalledWith(MOCK_TX_ID);
    });
  });

  describe('GET /api/v1/wallets/:walletId/transactions', () => {
    it('lists transactions for a wallet', async () => {
      const res = await app.request(`/api/v1/wallets/${MOCK_WALLET_ID}/transactions`);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.total).toBe(1);
    });

    it('passes query params through', async () => {
      const res = await app.request(
        `/api/v1/wallets/${MOCK_WALLET_ID}/transactions?page=2&pageSize=5`,
      );

      expect(res.status).toBe(200);
      expect(mockService.getTransactionsByWallet).toHaveBeenCalledWith(
        MOCK_WALLET_ID,
        expect.objectContaining({ page: 2, pageSize: 5 }),
      );
    });
  });
});
