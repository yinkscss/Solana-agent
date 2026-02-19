import { describe, it, expect } from 'vitest';
import {
  deriveFromSeed,
  deriveMultiple,
  generateSeed,
} from '../src/services/hd-derivation.service';

describe('HD Derivation Service', () => {
  const fixedSeed = new Uint8Array(32).fill(42);

  describe('deriveFromSeed', () => {
    it('produces deterministic results for the same seed and index', () => {
      const a = deriveFromSeed(fixedSeed, 0);
      const b = deriveFromSeed(fixedSeed, 0);

      expect(a.publicKey).toBe(b.publicKey);
      expect(a.derivationPath).toBe(b.derivationPath);
      expect(a.index).toBe(0);
    });

    it('produces different keys for different indices', () => {
      const a = deriveFromSeed(fixedSeed, 0);
      const b = deriveFromSeed(fixedSeed, 1);

      expect(a.publicKey).not.toBe(b.publicKey);
      expect(a.derivationPath).not.toBe(b.derivationPath);
    });

    it('returns a valid base58 public key', () => {
      const wallet = deriveFromSeed(fixedSeed, 0);
      expect(wallet.publicKey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    });

    it('includes the correct derivation path', () => {
      const wallet = deriveFromSeed(fixedSeed, 5);
      expect(wallet.derivationPath).toBe("m/44'/501'/5'/0'");
    });
  });

  describe('deriveMultiple', () => {
    it('returns the requested number of wallets', () => {
      const wallets = deriveMultiple(fixedSeed, 5);
      expect(wallets).toHaveLength(5);
    });

    it('starts from startIndex when provided', () => {
      const wallets = deriveMultiple(fixedSeed, 3, 10);

      expect(wallets[0]!.index).toBe(10);
      expect(wallets[1]!.index).toBe(11);
      expect(wallets[2]!.index).toBe(12);
    });

    it('produces unique keys for each wallet', () => {
      const wallets = deriveMultiple(fixedSeed, 5);
      const publicKeys = wallets.map((w) => w.publicKey);
      const unique = new Set(publicKeys);
      expect(unique.size).toBe(5);
    });

    it('defaults startIndex to 0', () => {
      const wallets = deriveMultiple(fixedSeed, 2);
      expect(wallets[0]!.index).toBe(0);
      expect(wallets[1]!.index).toBe(1);
    });
  });

  describe('generateSeed', () => {
    it('returns 32 bytes', () => {
      const seed = generateSeed();
      expect(seed).toBeInstanceOf(Uint8Array);
      expect(seed.length).toBe(32);
    });

    it('produces unique seeds', () => {
      const a = generateSeed();
      const b = generateSeed();
      expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
    });
  });
});
