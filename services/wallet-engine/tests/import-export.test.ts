import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { createImportExportService, type ExportedWallet } from '../src/services/import-export.service';
import type { WalletRepository } from '../src/services/wallet.service';
import type { KeyProvider, WalletRef } from '../src/providers/key-provider.interface';
import type { WalletRecord } from '../src/types';

const keypair = Keypair.generate();
const secretKey = keypair.secretKey;
const publicKey = keypair.publicKey.toBase58();

const makeWalletRecord = (): WalletRecord => ({
  id: 'wallet-1',
  agentId: 'agent-1',
  publicKey,
  provider: 'local',
  providerRef: 'ref-1',
  label: 'test',
  network: 'devnet',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeRepo = (): WalletRepository => ({
  findById: vi.fn().mockResolvedValue(makeWalletRecord()),
  findByAgentId: vi.fn().mockResolvedValue([]),
  insert: vi.fn().mockImplementation(async (rec) => ({ ...rec, createdAt: new Date(), updatedAt: new Date() })),
  updateStatus: vi.fn(),
});

const makeProvider = (): KeyProvider => ({
  name: 'local',
  createWallet: vi.fn(),
  getPublicKey: vi.fn(),
  signTransaction: vi.fn(),
  signMessage: vi.fn(),
  exportWallet: vi.fn().mockResolvedValue(secretKey),
});

describe('Import/Export Service', () => {
  let repo: WalletRepository;
  let provider: KeyProvider;
  let service: ReturnType<typeof createImportExportService>;

  beforeEach(() => {
    repo = makeRepo();
    provider = makeProvider();
    service = createImportExportService(repo, () => provider);
  });

  describe('exportWallet', () => {
    it('returns a valid ExportedWallet structure', async () => {
      const exported = await service.exportWallet('wallet-1', 'my-passphrase');

      expect(exported.version).toBe(1);
      expect(exported.publicKey).toBe(publicKey);
      expect(exported.keyProvider).toBe('local');
      expect(exported.network).toBe('devnet');
      expect(exported.encryptedKeyMaterial).toBeTruthy();
      expect(exported.exportedAt).toBeTruthy();
    });

    it('throws if wallet not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.exportWallet('missing', 'pass')).rejects.toThrow('Wallet not found');
    });

    it('throws if provider does not support export', async () => {
      const noExportProvider = { ...provider, exportWallet: undefined };
      const svc = createImportExportService(repo, () => noExportProvider);
      await expect(svc.exportWallet('wallet-1', 'pass')).rejects.toThrow('does not support key export');
    });
  });

  describe('importWallet', () => {
    it('round-trips: export then import produces the same public key', async () => {
      const exported = await service.exportWallet('wallet-1', 'strong-pass');
      const walletId = await service.importWallet(exported, 'strong-pass', 'agent-1', 'imported');

      expect(walletId).toBeTruthy();
      const insertCall = vi.mocked(repo.insert).mock.calls[0]![0];
      expect(insertCall.publicKey).toBe(publicKey);
    });

    it('fails with wrong passphrase', async () => {
      const exported = await service.exportWallet('wallet-1', 'correct-pass');
      await expect(
        service.importWallet(exported, 'wrong-pass', 'agent-1', 'imported'),
      ).rejects.toThrow();
    });

    it('fails with tampered encrypted data', async () => {
      const exported = await service.exportWallet('wallet-1', 'pass');
      const tampered: ExportedWallet = { ...exported, encryptedKeyMaterial: 'invalid-base64!' };
      await expect(
        service.importWallet(tampered, 'pass', 'agent-1', 'imported'),
      ).rejects.toThrow();
    });

    it('fails when decrypted key does not match public key', async () => {
      const otherKeypair = Keypair.generate();
      vi.mocked(provider.exportWallet!).mockResolvedValue(otherKeypair.secretKey);

      const exported = await service.exportWallet('wallet-1', 'pass');
      await expect(
        service.importWallet(exported, 'pass', 'agent-1', 'imported'),
      ).rejects.toThrow('does not match');
    });
  });
});
