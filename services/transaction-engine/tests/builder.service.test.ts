import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createBuilderService, type BuilderService } from '../src/services/builder.service';

const MOCK_BLOCKHASH = '4nQrX6xrG3Hv7kK5vRnMvJAuLLpGxFwZsEVYQBPUYwvt';
const SENDER = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const RECEIVER = '4fYNw3dojWmQ4dXtSGE9epjRGy9pFSx62YypT7avPYvA';
const MOCK_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const createMockConnection = () =>
  ({
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: MOCK_BLOCKHASH,
      lastValidBlockHeight: 100,
    }),
  }) as any;

const createMockRedis = () => {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, val: string) => {
      store.set(key, val);
      return 'OK';
    }),
  } as any;
};

describe('BuilderService', () => {
  let service: BuilderService;
  let mockConnection: ReturnType<typeof createMockConnection>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockConnection = createMockConnection();
    mockRedis = createMockRedis();
    service = createBuilderService(mockConnection, mockRedis);
  });

  describe('getRecentBlockhash', () => {
    it('fetches blockhash from RPC and caches in redis', async () => {
      const hash = await service.getRecentBlockhash();
      expect(hash).toBe(MOCK_BLOCKHASH);
      expect(mockConnection.getLatestBlockhash).toHaveBeenCalledOnce();
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('returns cached blockhash on second call', async () => {
      await service.getRecentBlockhash();
      const hash2 = await service.getRecentBlockhash();
      expect(hash2).toBe(MOCK_BLOCKHASH);
      expect(mockConnection.getLatestBlockhash).toHaveBeenCalledOnce();
    });
  });

  describe('buildTransferTransaction', () => {
    it('builds a SOL transfer transaction', async () => {
      const tx = await service.buildTransferTransaction(
        SENDER,
        RECEIVER,
        1_000_000_000n,
        MOCK_BLOCKHASH,
      );

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.instructions).toHaveLength(1);
      expect(tx.feePayer?.toBase58()).toBe(SENDER);
      expect(tx.recentBlockhash).toBe(MOCK_BLOCKHASH);

      const ix = tx.instructions[0]!;
      expect(ix.programId.equals(SystemProgram.programId)).toBe(true);
    });

    it('fetches blockhash when not provided', async () => {
      const tx = await service.buildTransferTransaction(
        SENDER,
        RECEIVER,
        500_000n,
      );

      expect(tx.recentBlockhash).toBe(MOCK_BLOCKHASH);
      expect(mockConnection.getLatestBlockhash).toHaveBeenCalled();
    });
  });

  describe('buildTokenTransferTransaction', () => {
    it('builds an SPL token transfer transaction', async () => {
      const tx = await service.buildTokenTransferTransaction(
        SENDER,
        RECEIVER,
        MOCK_MINT,
        1_000_000n,
        MOCK_BLOCKHASH,
      );

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.instructions).toHaveLength(1);
      expect(tx.feePayer?.toBase58()).toBe(SENDER);
    });
  });

  describe('buildCustomTransaction', () => {
    it('builds a transaction with custom instructions', async () => {
      const ix = new TransactionInstruction({
        programId: new PublicKey('11111111111111111111111111111111'),
        keys: [{ pubkey: new PublicKey(SENDER), isSigner: true, isWritable: true }],
        data: Buffer.from([]),
      });

      const tx = await service.buildCustomTransaction([ix], SENDER, MOCK_BLOCKHASH);

      expect(tx).toBeInstanceOf(Transaction);
      expect(tx.instructions).toHaveLength(1);
    });

    it('builds a transaction with zero instructions', async () => {
      const tx = await service.buildCustomTransaction([], SENDER, MOCK_BLOCKHASH);
      expect(tx.instructions).toHaveLength(0);
    });
  });
});
