import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWalletService, type WalletRepository } from '../src/services/wallet.service';
import type { WalletRecord } from '../src/types';
import { WalletNotFoundError, WalletFrozenError } from '../src/types';

vi.mock('../src/config/env', () => ({
  env: {
    PORT: 3002,
    DATABASE_URL: 'postgresql://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    SOLANA_NETWORK: 'devnet' as const,
    DEFAULT_KEY_PROVIDER: 'local' as const,
  },
}));

const makeWallet = (overrides: Partial<WalletRecord> = {}): WalletRecord => ({
  id: 'wallet-1',
  agentId: 'agent-1',
  publicKey: 'SomePublicKeyBase58',
  provider: 'local',
  providerRef: 'wallet-1',
  label: 'Test Wallet',
  network: 'devnet',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockRepo = (): WalletRepository & {
  _store: Map<string, WalletRecord>;
} => {
  const store = new Map<string, WalletRecord>();
  return {
    _store: store,
    insert: vi.fn(async (record) => {
      const full: WalletRecord = {
        ...record,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.set(record.id, full);
      return full;
    }),
    findById: vi.fn(async (id) => store.get(id) ?? null),
    findByAgentId: vi.fn(async (agentId) =>
      [...store.values()].filter((w) => w.agentId === agentId),
    ),
    updateStatus: vi.fn(async (id, status) => {
      const existing = store.get(id);
      if (!existing) return null;
      const updated = { ...existing, status, updatedAt: new Date() };
      store.set(id, updated);
      return updated;
    }),
  };
};

describe('WalletService', () => {
  let repo: ReturnType<typeof createMockRepo>;
  let service: ReturnType<typeof createWalletService>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepo();
    service = createWalletService(repo);
  });

  describe('createWallet', () => {
    it('should create a wallet and persist it', async () => {
      const wallet = await service.createWallet('agent-1', 'local', 'My Wallet', 'devnet');

      expect(wallet.agentId).toBe('agent-1');
      expect(wallet.label).toBe('My Wallet');
      expect(wallet.network).toBe('devnet');
      expect(wallet.status).toBe('active');
      expect(wallet.publicKey).toBeTruthy();
      expect(repo.insert).toHaveBeenCalledOnce();
    });

    it('should use default provider when none specified', async () => {
      const wallet = await service.createWallet('agent-1', undefined, 'Default Provider');

      expect(wallet.provider).toBe('local');
    });
  });

  describe('getWallet', () => {
    it('should return wallet by id', async () => {
      const existing = makeWallet();
      repo._store.set(existing.id, existing);

      const wallet = await service.getWallet('wallet-1');
      expect(wallet.id).toBe('wallet-1');
    });

    it('should throw WalletNotFoundError for missing wallet', async () => {
      await expect(service.getWallet('missing')).rejects.toThrow(WalletNotFoundError);
    });
  });

  describe('getWalletsByAgent', () => {
    it('should return all wallets for an agent', async () => {
      repo._store.set('w1', makeWallet({ id: 'w1', agentId: 'agent-1' }));
      repo._store.set('w2', makeWallet({ id: 'w2', agentId: 'agent-1' }));
      repo._store.set('w3', makeWallet({ id: 'w3', agentId: 'agent-2' }));

      const wallets = await service.getWalletsByAgent('agent-1');
      expect(wallets).toHaveLength(2);
    });

    it('should return empty array when agent has no wallets', async () => {
      const wallets = await service.getWalletsByAgent('no-agent');
      expect(wallets).toEqual([]);
    });
  });

  describe('deactivateWallet', () => {
    it('should set wallet status to frozen', async () => {
      repo._store.set('wallet-1', makeWallet());

      const wallet = await service.deactivateWallet('wallet-1');
      expect(wallet.status).toBe('frozen');
    });

    it('should throw for non-existent wallet', async () => {
      await expect(service.deactivateWallet('missing')).rejects.toThrow(WalletNotFoundError);
    });
  });

  describe('recoverWallet', () => {
    it('should set frozen wallet to recovering', async () => {
      repo._store.set('wallet-1', makeWallet({ status: 'frozen' }));

      const wallet = await service.recoverWallet('wallet-1');
      expect(wallet.status).toBe('recovering');
    });

    it('should reject recovery of non-frozen wallet', async () => {
      repo._store.set('wallet-1', makeWallet({ status: 'active' }));

      await expect(service.recoverWallet('wallet-1')).rejects.toThrow('Only frozen wallets');
    });
  });

  describe('signTransaction', () => {
    it('should sign with the correct provider', async () => {
      const created = await service.createWallet('agent-1', 'local', 'Sign Test', 'devnet');
      const txBytes = new Uint8Array([1, 2, 3, 4]);

      const signature = await service.signTransaction(created.id, txBytes);
      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
    });

    it('should refuse to sign with a frozen wallet', async () => {
      const created = await service.createWallet('agent-1', 'local', 'Frozen', 'devnet');
      await service.deactivateWallet(created.id);

      await expect(
        service.signTransaction(created.id, new Uint8Array([1])),
      ).rejects.toThrow(WalletFrozenError);
    });
  });
});
