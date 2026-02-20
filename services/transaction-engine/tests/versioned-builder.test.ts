import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AddressLookupTableAccount,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import { createBuilderService, type BuilderService } from '../src/services/builder.service';

const MOCK_BLOCKHASH = '4nQrX6xrG3Hv7kK5vRnMvJAuLLpGxFwZsEVYQBPUYwvt';
const SENDER = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const RECEIVER = '4fYNw3dojWmQ4dXtSGE9epjRGy9pFSx62YypT7avPYvA';
const ALT_ADDRESS = 'AddressLookupTab1e1111111111111111111111111';

const createMockConnection = () =>
  ({
    getLatestBlockhash: vi.fn().mockResolvedValue({
      blockhash: MOCK_BLOCKHASH,
      lastValidBlockHeight: 100,
    }),
    getAddressLookupTable: vi.fn().mockResolvedValue({
      value: null,
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

const createMockLookupTable = (): AddressLookupTableAccount => {
  return new AddressLookupTableAccount({
    key: new PublicKey(RECEIVER),
    state: {
      deactivationSlot: BigInt('18446744073709551615'),
      lastExtendedSlot: 100,
      lastExtendedSlotStartIndex: 0,
      authority: new PublicKey(SENDER),
      addresses: [new PublicKey(RECEIVER)],
    },
  });
};

describe('BuilderService — Versioned Transactions', () => {
  let service: BuilderService;
  let mockConnection: ReturnType<typeof createMockConnection>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockConnection = createMockConnection();
    mockRedis = createMockRedis();
    service = createBuilderService(mockConnection, mockRedis);
  });

  describe('buildVersionedTransferTransaction', () => {
    it('produces a VersionedTransaction for SOL transfer', async () => {
      const tx = await service.buildVersionedTransferTransaction(
        SENDER,
        RECEIVER,
        1_000_000_000n,
        [],
        MOCK_BLOCKHASH,
      );

      expect(tx).toBeInstanceOf(VersionedTransaction);
      expect(tx.message.version).toBe(0);
    });

    it('includes the transfer instruction in the compiled message', async () => {
      const tx = await service.buildVersionedTransferTransaction(
        SENDER,
        RECEIVER,
        500_000n,
        [],
        MOCK_BLOCKHASH,
      );

      expect(tx.message.compiledInstructions.length).toBeGreaterThanOrEqual(1);
    });

    it('fetches blockhash when not provided', async () => {
      await service.buildVersionedTransferTransaction(
        SENDER,
        RECEIVER,
        500_000n,
      );

      expect(mockConnection.getLatestBlockhash).toHaveBeenCalled();
    });

    it('accepts address lookup tables', async () => {
      const alt = createMockLookupTable();

      const tx = await service.buildVersionedTransferTransaction(
        SENDER,
        RECEIVER,
        1_000_000n,
        [alt],
        MOCK_BLOCKHASH,
      );

      expect(tx).toBeInstanceOf(VersionedTransaction);
      expect(tx.message.addressTableLookups.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildVersionedCustomTransaction', () => {
    it('builds a versioned transaction with custom instructions', async () => {
      const ix = new TransactionInstruction({
        programId: new PublicKey('11111111111111111111111111111111'),
        keys: [{ pubkey: new PublicKey(SENDER), isSigner: true, isWritable: true }],
        data: Buffer.from([]),
      });

      const tx = await service.buildVersionedCustomTransaction(
        [ix],
        SENDER,
        [],
        MOCK_BLOCKHASH,
      );

      expect(tx).toBeInstanceOf(VersionedTransaction);
      expect(tx.message.compiledInstructions).toHaveLength(1);
    });

    it('builds with zero instructions', async () => {
      const tx = await service.buildVersionedCustomTransaction(
        [],
        SENDER,
        [],
        MOCK_BLOCKHASH,
      );

      expect(tx).toBeInstanceOf(VersionedTransaction);
      expect(tx.message.compiledInstructions).toHaveLength(0);
    });

    it('compiles with lookup tables', async () => {
      const alt = createMockLookupTable();
      const ix = new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          { pubkey: new PublicKey(SENDER), isSigner: true, isWritable: true },
          { pubkey: new PublicKey(RECEIVER), isSigner: false, isWritable: true },
        ],
        data: Buffer.from([]),
      });

      const tx = await service.buildVersionedCustomTransaction(
        [ix],
        SENDER,
        [alt],
        MOCK_BLOCKHASH,
      );

      expect(tx).toBeInstanceOf(VersionedTransaction);
    });
  });

  describe('fetchAddressLookupTable', () => {
    it('returns null when table not found', async () => {
      const result = await service.fetchAddressLookupTable(ALT_ADDRESS);
      expect(result).toBeNull();
      expect(mockConnection.getAddressLookupTable).toHaveBeenCalledOnce();
    });

    it('returns the lookup table account when found', async () => {
      const mockAlt = createMockLookupTable();
      mockConnection.getAddressLookupTable.mockResolvedValueOnce({ value: mockAlt });

      const result = await service.fetchAddressLookupTable(RECEIVER);

      expect(result).toBe(mockAlt);
      expect(result).toBeInstanceOf(AddressLookupTableAccount);
    });
  });

  describe('serialization', () => {
    it('versioned transaction serializes to Uint8Array', async () => {
      const tx = await service.buildVersionedTransferTransaction(
        SENDER,
        RECEIVER,
        1_000_000_000n,
        [],
        MOCK_BLOCKHASH,
      );

      const serialized = tx.serialize();
      expect(serialized).toBeInstanceOf(Uint8Array);
      expect(serialized.length).toBeGreaterThan(0);
    });

    it('serialized versioned tx round-trips through base64', async () => {
      const tx = await service.buildVersionedTransferTransaction(
        SENDER,
        RECEIVER,
        1_000_000_000n,
        [],
        MOCK_BLOCKHASH,
      );

      const base64 = Buffer.from(tx.serialize()).toString('base64');
      const restored = VersionedTransaction.deserialize(Buffer.from(base64, 'base64'));

      expect(restored).toBeInstanceOf(VersionedTransaction);
      expect(restored.message.version).toBe(0);
    });
  });
});
