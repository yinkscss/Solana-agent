import { describe, it, expect, beforeEach } from 'vitest';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
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
    const buildUnsignedTx = (feePayer: PublicKey): Uint8Array => {
      const tx = new Transaction({
        recentBlockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi',
        feePayer,
      });
      tx.add(
        SystemProgram.transfer({
          fromPubkey: feePayer,
          toPubkey: feePayer,
          lamports: 1000n,
        }),
      );
      return tx.serialize({ requireAllSignatures: false });
    };

    it('should return a fully signed transaction (not a detached signature)', async () => {
      const wallet = await provider.createWallet({
        label: 'signer',
        network: 'devnet',
      });

      const unsigned = buildUnsignedTx(new PublicKey(wallet.publicKey));
      const result = await provider.signTransaction(wallet, unsigned);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(64);

      const signedTx = Transaction.from(result);
      expect(signedTx.signature).not.toBeNull();
    });

    it('should produce a verifiable signature inside the signed transaction', async () => {
      const wallet = await provider.createWallet({
        label: 'verify-test',
        network: 'devnet',
      });

      const feePayer = new PublicKey(wallet.publicKey);
      const unsigned = buildUnsignedTx(feePayer);
      const result = await provider.signTransaction(wallet, unsigned);

      const signedTx = Transaction.from(result);
      const sig = signedTx.signature!;
      expect(sig.length).toBe(64);

      const message = signedTx.serializeMessage();
      const valid = sign.detached.verify(message, sig, feePayer.toBytes());
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
