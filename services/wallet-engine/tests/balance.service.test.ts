import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBalanceService } from '../src/services/balance.service';
import type { WalletService } from '../src/services/wallet.service';
import type { WalletRecord } from '../src/types';

const mockWallet: WalletRecord = {
  id: 'wallet-1',
  agentId: 'agent-1',
  publicKey: '11111111111111111111111111111111',
  provider: 'local',
  providerRef: 'ref-1',
  label: 'Test',
  network: 'devnet',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createMockRedis = () => ({
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
});

const createMockConnection = () => ({
  getBalance: vi.fn(),
  getParsedTokenAccountsByOwner: vi.fn(),
});

const createMockWalletService = (): WalletService =>
  ({
    getWallet: vi.fn(async () => mockWallet),
  }) as any;

describe('BalanceService', () => {
  let redis: ReturnType<typeof createMockRedis>;
  let connection: ReturnType<typeof createMockConnection>;
  let walletService: ReturnType<typeof createMockWalletService>;
  let service: ReturnType<typeof createBalanceService>;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = createMockRedis();
    connection = createMockConnection();
    walletService = createMockWalletService();
    service = createBalanceService(walletService, redis as any, connection as any);
  });

  describe('getBalance', () => {
    it('should return cached balance on cache hit', async () => {
      const cached = JSON.stringify({
        walletId: 'wallet-1',
        publicKey: '11111111111111111111111111111111',
        solBalance: 1.5,
        lamports: '1500000000n',
      });
      redis.get.mockResolvedValue(cached);

      const result = await service.getBalance('wallet-1');

      expect(result.solBalance).toBe(1.5);
      expect(result.lamports).toBe(BigInt(1500000000));
      expect(redis.get).toHaveBeenCalledWith('wallet:balance:wallet-1');
      expect(connection.getBalance).not.toHaveBeenCalled();
    });

    it('should fetch from RPC on cache miss and cache the result', async () => {
      redis.get.mockResolvedValue(null);
      connection.getBalance.mockResolvedValue(2_000_000_000);

      const result = await service.getBalance('wallet-1');

      expect(result.solBalance).toBe(2);
      expect(result.lamports).toBe(BigInt(2_000_000_000));
      expect(connection.getBalance).toHaveBeenCalledOnce();
      expect(redis.setex).toHaveBeenCalledWith(
        'wallet:balance:wallet-1',
        5,
        expect.any(String),
      );
    });
  });

  describe('getTokenBalances', () => {
    it('should return cached token balances on cache hit', async () => {
      const cached = JSON.stringify([
        {
          mint: 'TokenMint1',
          amount: '1000000',
          decimals: 6,
          uiAmount: 1.0,
          ataAddress: 'ATA1',
        },
      ]);
      redis.get.mockResolvedValue(cached);

      const result = await service.getTokenBalances('wallet-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.mint).toBe('TokenMint1');
      expect(connection.getParsedTokenAccountsByOwner).not.toHaveBeenCalled();
    });

    it('should fetch from RPC on cache miss', async () => {
      redis.get.mockResolvedValue(null);
      connection.getParsedTokenAccountsByOwner.mockResolvedValue({
        value: [
          {
            pubkey: { toBase58: () => 'ATA1' },
            account: {
              data: {
                parsed: {
                  info: {
                    mint: 'USDC',
                    tokenAmount: {
                      amount: '5000000',
                      decimals: 6,
                      uiAmount: 5.0,
                    },
                  },
                },
              },
            },
          },
        ],
      });

      const result = await service.getTokenBalances('wallet-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.mint).toBe('USDC');
      expect(result[0]!.uiAmount).toBe(5.0);
      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('invalidateBalanceCache', () => {
    it('should delete both balance and token cache keys', async () => {
      await service.invalidateBalanceCache('wallet-1');

      expect(redis.del).toHaveBeenCalledWith(
        'wallet:balance:wallet-1',
        'wallet:tokens:wallet-1',
      );
    });
  });
});
