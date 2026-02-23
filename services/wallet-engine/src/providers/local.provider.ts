import { Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sign } from 'tweetnacl';
import type { CreateWalletOpts, KeyProvider, WalletRef } from './key-provider.interface';
import { ProviderError } from '../types';

const findProjectRoot = (): string => {
  let dir = process.cwd();
  while (dir !== '/') {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'turbo.json'))) return dir;
    dir = join(dir, '..');
  }
  return process.cwd();
};

const KEYS_DIR = join(findProjectRoot(), '.keys', 'wallets');

export class LocalProvider implements KeyProvider {
  readonly name = 'local';
  private readonly keypairs = new Map<string, Keypair>();

  constructor() {
    this.loadPersistedKeys();
  }

  createWallet = async (_opts: CreateWalletOpts): Promise<WalletRef> => {
    const keypair = Keypair.generate();
    const id = randomUUID();
    this.keypairs.set(id, keypair);
    this.persistKey(id, keypair);

    return {
      id,
      publicKey: keypair.publicKey.toBase58(),
      provider: this.name,
      providerRef: id,
    };
  };

  getPublicKey = async (walletRef: WalletRef): Promise<string> => {
    const keypair = this.resolveKeypair(walletRef);
    return keypair.publicKey.toBase58();
  };

  signTransaction = async (walletRef: WalletRef, transaction: Uint8Array): Promise<Uint8Array> => {
    const keypair = this.resolveKeypair(walletRef);

    try {
      const vtx = VersionedTransaction.deserialize(transaction);
      vtx.sign([keypair]);
      return vtx.serialize();
    } catch {
      const tx = Transaction.from(transaction);
      tx.partialSign(keypair);
      return tx.serialize();
    }
  };

  signMessage = async (walletRef: WalletRef, message: Uint8Array): Promise<Uint8Array> => {
    const keypair = this.resolveKeypair(walletRef);
    return sign.detached(message, keypair.secretKey);
  };

  exportWallet = async (walletRef: WalletRef): Promise<Uint8Array> => {
    const keypair = this.resolveKeypair(walletRef);
    return keypair.secretKey;
  };

  private resolveKeypair = (walletRef: WalletRef): Keypair => {
    const keypair = this.keypairs.get(walletRef.providerRef);
    if (!keypair) {
      throw new ProviderError(this.name, `Keypair not found for ref: ${walletRef.providerRef}`);
    }
    return keypair;
  };

  private persistKey(id: string, keypair: Keypair): void {
    try {
      if (!existsSync(KEYS_DIR)) mkdirSync(KEYS_DIR, { recursive: true });
      writeFileSync(join(KEYS_DIR, `${id}.json`), JSON.stringify(Array.from(keypair.secretKey)));
    } catch (err) {
      console.error(`[LocalProvider] Failed to persist key ${id}:`, err);
    }
  }

  private loadPersistedKeys(): void {
    try {
      if (!existsSync(KEYS_DIR)) return;
      const files = readdirSync(KEYS_DIR).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const id = file.replace('.json', '');
        const raw = readFileSync(join(KEYS_DIR, file), 'utf-8');
        const secretKey = new Uint8Array(JSON.parse(raw));
        this.keypairs.set(id, Keypair.fromSecretKey(secretKey));
      }
      if (files.length > 0) {
        console.log(`[LocalProvider] Loaded ${files.length} persisted keypairs`);
      }
    } catch (err) {
      console.error('[LocalProvider] Failed to load persisted keys:', err);
    }
  }
}
