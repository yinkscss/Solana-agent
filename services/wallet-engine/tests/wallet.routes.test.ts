import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { createWalletRoutes, createAgentWalletRoutes } from '../src/routes/wallets';
import { createWalletController } from '../src/controllers/wallet.controller';
import { errorHandler } from '../src/middleware/error-handler';
import type { WalletService } from '../src/services/wallet.service';
import type { BalanceService } from '../src/services/balance.service';
import type { WalletRecord } from '../src/types';

const mockWallet: WalletRecord = {
  id: 'wallet-1',
  agentId: 'agent-1',
  publicKey: 'PubKey123',
  provider: 'local',
  providerRef: 'ref-1',
  label: 'Test Wallet',
  network: 'devnet',
  status: 'active',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const createMockWalletService = (): WalletService =>
  ({
    createWallet: vi.fn(async () => mockWallet),
    getWallet: vi.fn(async () => mockWallet),
    getWalletsByAgent: vi.fn(async () => [mockWallet]),
    deactivateWallet: vi.fn(async () => ({ ...mockWallet, status: 'frozen' as const })),
    recoverWallet: vi.fn(async () => ({ ...mockWallet, status: 'recovering' as const })),
    signTransaction: vi.fn(async () => new Uint8Array([1, 2, 3])),
  }) as any;

const createMockBalanceService = (): BalanceService =>
  ({
    getBalance: vi.fn(async () => ({
      walletId: 'wallet-1',
      publicKey: 'PubKey123',
      solBalance: 1.5,
      lamports: 1500000000,
    })),
    getTokenBalances: vi.fn(async () => []),
    invalidateBalanceCache: vi.fn(),
  }) as any;

const createTestApp = () => {
  const walletService = createMockWalletService();
  const balanceService = createMockBalanceService();
  const controller = createWalletController(walletService, balanceService);

  const app = new Hono();
  app.route('/api/v1/wallets', createWalletRoutes(controller));
  app.route('/api/v1/agents', createAgentWalletRoutes(controller));
  app.onError(errorHandler);

  return { app, walletService, balanceService };
};

describe('Wallet Routes', () => {
  let app: Hono;
  let walletService: WalletService;
  let balanceService: BalanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    const ctx = createTestApp();
    app = ctx.app;
    walletService = ctx.walletService;
    balanceService = ctx.balanceService;
  });

  describe('POST /api/v1/wallets', () => {
    it('should create a wallet and return 201', async () => {
      const res = await app.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-1',
          label: 'Test Wallet',
          network: 'devnet',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.publicKey).toBe('PubKey123');
      expect(walletService.createWallet).toHaveBeenCalledOnce();
    });

    it('should return 400 for invalid body', async () => {
      const res = await app.request('/api/v1/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/wallets/:walletId', () => {
    it('should return wallet by id', async () => {
      const res = await app.request('/api/v1/wallets/wallet-1');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe('wallet-1');
    });
  });

  describe('GET /api/v1/wallets/:walletId/balance', () => {
    it('should return balance info', async () => {
      const res = await app.request('/api/v1/wallets/wallet-1/balance');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.solBalance).toBe(1.5);
      expect(balanceService.getBalance).toHaveBeenCalledWith('wallet-1');
    });
  });

  describe('GET /api/v1/wallets/:walletId/tokens', () => {
    it('should return token balances', async () => {
      const res = await app.request('/api/v1/wallets/wallet-1/tokens');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual([]);
    });
  });

  describe('DELETE /api/v1/wallets/:walletId', () => {
    it('should deactivate wallet', async () => {
      const res = await app.request('/api/v1/wallets/wallet-1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('frozen');
    });
  });

  describe('POST /api/v1/wallets/:walletId/recover', () => {
    it('should trigger wallet recovery', async () => {
      const res = await app.request('/api/v1/wallets/wallet-1/recover', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('recovering');
    });
  });

  describe('POST /api/v1/wallets/:walletId/sign', () => {
    it('should sign a transaction', async () => {
      const res = await app.request('/api/v1/wallets/wallet-1/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: Buffer.from([1, 2, 3]).toString('base64'),
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.signature).toBeTruthy();
    });
  });

  describe('GET /api/v1/agents/:agentId/wallets', () => {
    it('should return wallets for an agent', async () => {
      const res = await app.request('/api/v1/agents/agent-1/wallets');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(walletService.getWalletsByAgent).toHaveBeenCalledWith('agent-1');
    });
  });
});
