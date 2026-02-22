import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTransactionService, type TransactionRepository, type TransactionService } from '../src/services/transaction.service';
import type { TransactionRecord } from '../src/types';
import type { TransactionStatus } from '@solagent/common';

const MOCK_WALLET_ID = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const MOCK_DEST = '4fYNw3dojWmQ4dXtSGE9epjRGy9pFSx62YypT7avPYvA';
const MOCK_SIGNATURE = '5UfDuX7WXYjABmLELhx2GR1NMRQYUMSbWL3JRPdVqvXbGYy5bUPWKSDAzrLBTKbc4kYk3d6sqFVpN8RaFfyDJqU';

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
    updateStatus: vi.fn(async (id, status: TransactionStatus, patch?) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch, status } as TransactionRecord;
      store.set(id, updated);
      return updated;
    }),
  };
};

const FAKE_SERIALIZED = Buffer.from('fake-serialized-tx').toString('base64');

const createMockDeps = (overrides?: Record<string, unknown>) => ({
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
      logs: ['Program log: hello'],
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
    calculatePriorityFee: vi.fn(async () => 5000),
  },
  walletResolver: {
    getPublicKey: vi.fn(async () => MOCK_WALLET_ID),
  },
  maxRetries: 3,
  ...overrides,
});

describe('TransactionService', () => {
  let service: TransactionService;
  let deps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    deps = createMockDeps();
    service = createTransactionService(deps as any);
  });

  describe('createAndExecuteTransaction — success', () => {
    it('completes the full lifecycle: build → simulate → policy → sign → submit → confirm', async () => {
      const result = await service.createAndExecuteTransaction({
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });

      expect(result.status).toBe('confirmed');
      expect(result.signature).toBe(MOCK_SIGNATURE);
      expect(deps.simulator.simulateTransaction).toHaveBeenCalledOnce();
      expect(deps.policyClient.evaluateTransaction).toHaveBeenCalledOnce();
      expect(deps.signer.signTransaction).toHaveBeenCalled();
      expect(deps.submitter.submitTransaction).toHaveBeenCalled();
      expect(deps.confirmation.waitForConfirmation).toHaveBeenCalledWith(MOCK_SIGNATURE);
    });
  });

  describe('createAndExecuteTransaction — simulation failure', () => {
    it('transitions to simulation_failed on sim error', async () => {
      deps.simulator.simulateTransaction.mockResolvedValueOnce({
        success: false,
        logs: [],
        unitsConsumed: 0,
        error: 'InstructionError: insufficient funds',
      });

      const result = await service.createAndExecuteTransaction({
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '999999999999',
      });

      expect(result.status).toBe('simulation_failed');
      expect(result.errorMessage).toContain('insufficient funds');
      expect(deps.signer.signTransaction).not.toHaveBeenCalled();
    });
  });

  describe('createAndExecuteTransaction — policy deny', () => {
    it('transitions to rejected when policy denies', async () => {
      deps.policyClient.evaluateTransaction.mockResolvedValueOnce({
        decision: 'deny',
        reasons: ['Spending limit exceeded'],
      });

      const result = await service.createAndExecuteTransaction({
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });

      expect(result.status).toBe('rejected');
      expect(result.errorMessage).toContain('Spending limit exceeded');
      expect(deps.signer.signTransaction).not.toHaveBeenCalled();
    });
  });

  describe('createAndExecuteTransaction — policy requires approval', () => {
    it('transitions to awaiting_approval', async () => {
      deps.policyClient.evaluateTransaction.mockResolvedValueOnce({
        decision: 'require_approval',
        reasons: ['High value transaction'],
        approvalId: 'approval-123',
      });

      const result = await service.createAndExecuteTransaction({
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '99000000000',
      });

      expect(result.status).toBe('awaiting_approval');
    });
  });

  describe('createAndExecuteTransaction — signing failure', () => {
    it('transitions to signing_failed when wallet engine fails', async () => {
      deps.signer.signTransaction.mockRejectedValueOnce(new Error('Wallet frozen'));

      const result = await service.createAndExecuteTransaction({
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });

      expect(result.status).toBe('signing_failed');
      expect(result.errorMessage).toContain('Wallet frozen');
    });
  });

  describe('getTransaction', () => {
    it('returns a transaction by id', async () => {
      const created = await service.createAndExecuteTransaction({
        walletId: MOCK_WALLET_ID,
        type: 'transfer',
        destination: MOCK_DEST,
        amount: '1000000',
      });

      const found = await service.getTransaction(created.id);
      expect(found.id).toBe(created.id);
    });

    it('throws TransactionNotFoundError for unknown id', async () => {
      await expect(service.getTransaction('nonexistent')).rejects.toThrow('Transaction not found');
    });
  });

  describe('getTransactionsByWallet', () => {
    it('delegates to repo with options', async () => {
      await service.getTransactionsByWallet(MOCK_WALLET_ID, { page: 1, pageSize: 10 });
      expect(deps.repo.findByWalletId).toHaveBeenCalledWith(
        MOCK_WALLET_ID,
        { page: 1, pageSize: 10 },
      );
    });
  });
});
