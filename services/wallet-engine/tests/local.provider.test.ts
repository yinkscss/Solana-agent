import { describe, it, expect, beforeEach } from 'vitest';
import { LocalProvider } from '../src/providers/local.provider';
import type { WalletRef } from '../src/providers/key-provider.interface';
import { sign } from 'tweetnacl';

describe('LocalProvider', () => {
  let provider: LocalProvider;

  beforeEach(() => {
    provider = new LocalProvider();
  });

  describe('createWallet', () => {
    it('should generate a new wallet with a valid public key', async () => {
      const result = await provider.createWallet({
        label: 'test-wallet',
        network: 'devnet',
      });

      expect(result.id).toBeTruthy();
      expect(result.publicKey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(result.provider).toBe('local');
      expect(result.providerRef).toBe(result.id);
    });

    it('should generate unique wallets each time', async () => {
      const w1 = await provider.createWallet({ label: 'w1', network: 'devnet' });
      const w2 = await provider.createWallet({ label: 'w2', network: 'devnet' });

      expect(w1.publicKey).not.toBe(w2.publicKey);
      expect(w1.id).not.toBe(w2.id);
    });
  });

  describe('getPublicKey', () => {
    it('should return the public key for an existing wallet', async () => {
      const wallet = await provider.createWallet({
        label: 'test',
        network: 'devnet',
      });

      const pubkey = await provider.getPublicKey(wallet);
      expect(pubkey).toBe(wallet.publicKey);
    });

    it('should throw for unknown wallet ref', async () => {
      const fakeRef: WalletRef = {
        id: 'missing',
        publicKey: 'fake',
        provider: 'local',
        providerRef: 'missing',
      };

      await expect(provider.getPublicKey(fakeRef)).rejects.toThrow('Keypair not found');
    });
  });

  describe('signTransaction', () => {
    it('should produce a valid Ed25519 signature', async () => {
      const wallet = await provider.createWallet({
        label: 'signer',
        network: 'devnet',
      });

      const message = new Uint8Array([1, 2, 3, 4, 5]);
      const signature = await provider.signTransaction(wallet, message);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
    });

    it('should produce a verifiable signature', async () => {
      const wallet = await provider.createWallet({
        label: 'verify-test',
        network: 'devnet',
      });

      const message = new Uint8Array([10, 20, 30]);
      const sig = await provider.signTransaction(wallet, message);
      const secretKey = await provider.exportWallet!(wallet);

      const publicKeyBytes = secretKey.slice(32);
      const valid = sign.detached.verify(message, sig, publicKeyBytes);
      expect(valid).toBe(true);
    });
  });

  describe('signMessage', () => {
    it('should sign an arbitrary message', async () => {
      const wallet = await provider.createWallet({
        label: 'msg-signer',
        network: 'devnet',
      });

      const message = new TextEncoder().encode('Hello SolAgent');
      const signature = await provider.signMessage(wallet, message);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64);
    });
  });

  describe('exportWallet', () => {
    it('should return the 64-byte secret key', async () => {
      const wallet = await provider.createWallet({
        label: 'export-test',
        network: 'devnet',
      });

      const secretKey = await provider.exportWallet!(wallet);
      expect(secretKey).toBeInstanceOf(Uint8Array);
      expect(secretKey.length).toBe(64);
    });
  });
});
